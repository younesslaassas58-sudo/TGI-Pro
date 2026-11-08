import { z } from 'zod'
import type { VercelRequest as Request, VercelResponse as Response } from '@vercel/node'
import { getAdminAuth, getAdminDb } from '../_lib/admin'
import { defaultCompanySettings } from '../../src/features/parametres/defaults'
import { ascenseurSchema, nextVisitDate } from '../../src/features/parc/types'
import { calculerMouvement, cleSourceMouvement } from '../../src/features/stock/logic'
import { articleSchema } from '../../src/features/catalogue/types'
import { interventionSchema } from '../../src/features/interventions/types'
import { completionAllowed } from '../../src/features/interventions/logic'
import { depotSchema, mouvementSchema, stockCoutSchema, stockNiveauSchema } from '../../src/features/stock/types'

const requestSchema = z.object({
  interventionId: z.string().min(1),
  depotId: z.string().optional(),
})

class CompletionError extends Error {
  readonly status: 400 | 403 | 404 | 409

  constructor(message: string, status: 400 | 403 | 404 | 409) {
    super(message)
    this.name = 'CompletionError'
    this.status = status
  }
}

function respond(res: Response, status: number, body: { ok: false; error: string } | { ok: true; data: { id: string; statut: string } }) {
  res.status(status).json(body)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    respond(res, 405, { ok: false, error: 'Méthode non autorisée.' })
    return
  }
  const contentLength = Number(req.headers['content-length'] ?? 0)
  let serialized: string
  try {
    serialized = JSON.stringify(req.body ?? '')
  } catch {
    respond(res, 400, { ok: false, error: 'Corps JSON invalide.' })
    return
  }
  if (contentLength > 16_000 || Buffer.byteLength(serialized) > 16_000) {
    respond(res, 413, { ok: false, error: 'La requête dépasse la taille maximale autorisée.' })
    return
  }
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) {
    respond(res, 400, { ok: false, error: 'Identifiant d’intervention invalide.' })
    return
  }
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : ''
  if (!token) {
    respond(res, 401, { ok: false, error: 'Authentification requise.' })
    return
  }

  let uid: string
  let db: ReturnType<typeof getAdminDb>
  let adminAuth: ReturnType<typeof getAdminAuth>
  try {
    adminAuth = getAdminAuth()
    db = getAdminDb()
  } catch {
    respond(res, 500, { ok: false, error: 'La configuration serveur Firebase est indisponible.' })
    return
  }
  try {
    uid = (await adminAuth.verifyIdToken(token, true)).uid
  } catch {
    respond(res, 401, { ok: false, error: 'Jeton d’authentification invalide ou expiré.' })
    return
  }

  try {
    const profileSnapshot = await db.collection('users').doc(uid).get()
    const profile = profileSnapshot.data()
    if (!profileSnapshot.exists || profile?.active !== true) {
      respond(res, 403, { ok: false, error: 'Compte absent ou désactivé.' })
      return
    }
    if (!['directeur', 'commercial', 'technicien'].includes(String(profile.role))) {
      respond(res, 403, { ok: false, error: 'Vous ne pouvez pas terminer cette intervention.' })
      return
    }

    const interventionRef = db.collection('interventions').doc(parsed.data.interventionId)
    const result = await db.runTransaction(async (transaction) => {
      const interventionSnapshot = await transaction.get(interventionRef)
      if (!interventionSnapshot.exists) throw new CompletionError('Intervention introuvable.', 404)
      const intervention = interventionSchema.parse({ ...interventionSnapshot.data(), id: interventionSnapshot.id })
      if (profile.role === 'technicien' && !intervention.techniciensUids.includes(uid)) {
        throw new CompletionError('Cette intervention ne vous est pas assignée.', 403)
      }
      if (!['directeur', 'commercial', 'technicien'].includes(String(profile.role))) {
        throw new CompletionError('Vous ne pouvez pas terminer cette intervention.', 403)
      }
      if (!completionAllowed(intervention)) {
        throw new CompletionError(
          intervention.mouvementsStockGeneres
            ? 'Les mouvements de cette intervention ont déjà été générés.'
            : 'Seule une intervention en cours peut être terminée.',
          409,
        )
      }

      const trackedParts = intervention.piecesUtilisees.filter((part) => part.articleId && part.quantite > 0)
      const [elevatorSnapshot, depotsSnapshot, settingsSnapshot] = await Promise.all([
        transaction.get(db.collection('ascenseurs').doc(intervention.ascenseurId)),
        transaction.get(db.collection('depots')),
        transaction.get(db.collection('settings').doc('company')),
      ])
      if (!elevatorSnapshot.exists) throw new CompletionError('L’appareil lié est introuvable.', 404)
      const elevator = ascenseurSchema.parse({ ...elevatorSnapshot.data(), id: elevatorSnapshot.id })
      const depots = depotsSnapshot.docs.map((snapshot) => depotSchema.parse({ ...snapshot.data(), id: snapshot.id }))
      const principalDepot = depots.find((depot) =>
        depot.type === 'vehicule'
        && depot.technicienId === intervention.technicienPrincipalId
        && depot.actif
        && !depot.archive,
      )
      const articlesRefs = new Map(trackedParts.map((part) => [part.articleId!, db.collection('articles').doc(part.articleId!)]))
      const articlesSnapshots = await Promise.all([...articlesRefs.values()].map((reference) => transaction.get(reference)))
      const articles = new Map([...articlesRefs.keys()].map((articleId, index) => {
        const snapshot = articlesSnapshots[index]
        if (!snapshot.exists) throw new CompletionError(`L’article ${articleId} n’existe plus dans le catalogue.`, 409)
        return [articleId, articleSchema.parse({ ...snapshot.data(), id: snapshot.id })]
      }))
      const eligibleParts = trackedParts.filter((part) => articles.get(part.articleId!)?.suiviStock)
      const partsWithDepot = eligibleParts.map((part) => {
        const depotId = part.depotId || parsed.data.depotId || principalDepot?.id
        if (!depotId) throw new CompletionError(`Aucun dépôt véhicule actif n’est associé à l’intervention pour l’article « ${part.designation} ».`, 409)
        const depot = depots.find((entry) => entry.id === depotId)
        if (!depot || !depot.actif || depot.archive) {
          throw new CompletionError(`Le dépôt de l’article « ${part.designation} » est introuvable ou inactif.`, 409)
        }
        if (profile.role === 'technicien' && (depot.type !== 'vehicule' || depot.technicienUid !== uid)) {
          throw new CompletionError('Un technicien ne peut débiter que son propre dépôt véhicule.', 403)
        }
        return { part, depotId }
      })

      const levelRefs = new Map<string, FirebaseFirestore.DocumentReference>()
      const costRefs = new Map<string, FirebaseFirestore.DocumentReference>()
      const movementRefs = new Map<string, FirebaseFirestore.DocumentReference>()
      for (const { part, depotId } of partsWithDepot) {
        const articleId = part.articleId!
        const levelId = `${articleId}_${depotId}`
        levelRefs.set(levelId, db.collection('stockNiveaux').doc(levelId))
        costRefs.set(articleId, db.collection('stockCouts').doc(articleId))
        const movementId = cleSourceMouvement('intervention', intervention.id, part.id)
        movementRefs.set(movementId, db.collection('mouvements').doc(movementId))
      }
      const [levelSnapshots, costSnapshots, movementSnapshots, numberingSnapshot] = await Promise.all([
        Promise.all([...levelRefs.values()].map((reference) => transaction.get(reference))),
        Promise.all([...costRefs.values()].map((reference) => transaction.get(reference))),
        Promise.all([...movementRefs.values()].map((reference) => transaction.get(reference))),
        transaction.get(db.collection('settings').doc('counters').collection('items').doc(`mouvement_stock_${new Date().getFullYear()}`)),
      ])
      if (movementSnapshots.some((snapshot) => snapshot.exists)) {
        throw new CompletionError('Une sortie de stock existe déjà pour au moins une ligne de cette intervention.', 409)
      }
      const year = new Date().getFullYear()
      const defaultNumbering = defaultCompanySettings.numbering.mouvement_stock
      const savedNumbering = settingsSnapshot.data()?.numbering?.mouvement_stock
      const prefix = typeof savedNumbering?.prefix === 'string' ? savedNumbering.prefix : defaultNumbering.prefix
      const format = typeof savedNumbering?.format === 'string' ? savedNumbering.format : defaultNumbering.format
      const digits = typeof savedNumbering?.counterLength === 'number' ? savedNumbering.counterLength : 4
      let counter = numberingSnapshot.exists ? Number(numberingSnapshot.data()?.value ?? 0) : 0
      if (!Number.isInteger(counter) || counter < 0) throw new CompletionError('Le compteur des mouvements de stock est invalide.', 409)
      const levelValues = new Map<string, ReturnType<typeof stockNiveauSchema.parse>>()
      const costValues = new Map<string, ReturnType<typeof stockCoutSchema.parse>>()
      const newMovements: Array<{ ref: FirebaseFirestore.DocumentReference; data: ReturnType<typeof mouvementSchema.parse> }> = []
      const levelById = new Map([...levelRefs.keys()].map((key, index) => [key, levelSnapshots[index]]))
      const costById = new Map([...costRefs.keys()].map((key, index) => [key, costSnapshots[index]]))
      const autoriserNegatif = profile.role === 'directeur' && settingsSnapshot.data()?.autoriserStockNegatif === true
      const now = new Date().toISOString()
      const shortages = new Set<string>()

      for (const { part, depotId } of partsWithDepot) {
        const articleId = part.articleId!
        const article = articles.get(articleId)!
        const levelId = `${articleId}_${depotId}`
        const levelSnapshot = levelById.get(levelId)
        const level = levelValues.get(levelId)
          ?? (levelSnapshot?.exists
            ? stockNiveauSchema.parse({ ...levelSnapshot.data(), id: levelSnapshot.id })
            : stockNiveauSchema.parse({
                id: levelId, articleId, depotId, quantite: 0, codeSnapshot: article.code,
                designationSnapshot: article.designation, unite: article.unite, updatedAt: now,
              }))
        const costSnapshot = costById.get(articleId)
        const initialCost = costSnapshot?.exists
          ? stockCoutSchema.parse(costSnapshot.data())
          : stockCoutSchema.parse({
              articleId, pmpHT: article.prixAchatCents, dernierPrixAchatHT: article.prixAchatCents,
              quantiteTotale: 0, updatedAt: now,
            })
        const cost = costValues.get(articleId) ?? initialCost
        if (level.quantite < part.quantite && !autoriserNegatif) {
          shortages.add(part.designation)
          continue
        }
        const plan = calculerMouvement({
          type: 'sortie',
          quantite: part.quantite,
          quantiteSource: level.quantite,
          quantiteDestination: 0,
          quantiteTotale: cost.quantiteTotale,
          pmpHT: cost.pmpHT,
          autoriserStockNegatif: autoriserNegatif,
        })
        levelValues.set(levelId, { ...level, quantite: plan.quantiteSource, updatedAt: now })
        costValues.set(articleId, { ...cost, pmpHT: plan.pmpHT, quantiteTotale: plan.quantiteTotale, updatedAt: now })
        counter += 1
        const number = format.replaceAll('{PREFIX}', prefix).replaceAll('{YYYY}', String(year)).replaceAll('{NUM}', String(counter).padStart(digits, '0'))
        const movementId = cleSourceMouvement('intervention', intervention.id, part.id)
        const movement = mouvementSchema.parse({
          id: movementId,
          numero: number,
          date: now.slice(0, 10),
          type: 'sortie_intervention',
          articleId,
          codeSnapshot: article.code,
          designationSnapshot: article.designation,
          unite: article.unite,
          depotSourceId: depotId,
          quantite: part.quantite,
          pmpAvant: cost.pmpHT,
          pmpApres: plan.pmpHT,
          soldeSourceApres: plan.quantiteSource,
          reference: { type: 'intervention', id: intervention.id, interventionId: intervention.id },
          motif: `Intervention ${intervention.numero}`,
          uid,
          auteurNom: typeof profile.displayName === 'string' ? profile.displayName : '',
          annule: false,
          createdAt: now,
        })
        newMovements.push({ ref: movementRefs.get(movementId)!, data: movement })
      }
      if (shortages.size) throw new CompletionError(`Stock insuffisant pour : ${[...shortages].join(', ')}.`, 409)
      if (counter > (numberingSnapshot.exists ? Number(numberingSnapshot.data()?.value ?? 0) : 0)) {
        transaction.set(numberingSnapshot.ref, { value: counter })
      }
      for (const [levelId, value] of levelValues) transaction.set(levelRefs.get(levelId)!, value)
      for (const [articleId, value] of costValues) transaction.set(costRefs.get(articleId)!, value)
      for (const movement of newMovements) transaction.create(movement.ref, movement.data)
      const history = [...intervention.historiqueStatuts, {
        statut: 'terminee' as const,
        date: now,
        uid,
        nom: typeof profile.displayName === 'string' ? profile.displayName : '',
      }]
      transaction.update(interventionRef, {
        statut: 'terminee',
        dateFinReelle: now,
        dureeMinutes: intervention.dateDebutReelle
          ? Math.max(0, Math.round((Date.parse(now) - Date.parse(intervention.dateDebutReelle)) / 60_000))
          : intervention.dureeMinutes,
        mouvementsStockGeneres: true,
        historiqueStatuts: history,
        updatedAt: now,
        updatedBy: uid,
      })
      transaction.update(db.collection('ascenseurs').doc(elevator.id), {
        etatAppareil: intervention.etatApresIntervention,
        derniereVisite: now.slice(0, 10),
        prochaineVisite: nextVisitDate(now.slice(0, 10), elevator.periodiciteVisiteJours),
        updatedAt: now,
        updatedBy: uid,
      })
      return { id: intervention.id, statut: 'terminee' }
    })
    respond(res, 200, { ok: true, data: result })
  } catch (error) {
    if (error instanceof CompletionError) {
      respond(res, error.status, { ok: false, error: error.message })
    } else if (error instanceof z.ZodError) {
      respond(res, 409, { ok: false, error: 'Les données de l’intervention, du parc ou du stock sont incohérentes.' })
    } else {
      respond(res, 500, { ok: false, error: 'Impossible de terminer l’intervention en raison d’une erreur serveur.' })
    }
  }
}
