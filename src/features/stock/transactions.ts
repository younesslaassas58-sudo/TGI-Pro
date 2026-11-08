import {
  doc,
  type DocumentReference,
  type Transaction,
} from 'firebase/firestore'
import { articleSchema } from '@/features/catalogue/types'
import { db } from '@/lib/firebase'
import { calculerMouvement, cleSourceMouvement } from './logic'
import {
  depotSchema,
  mouvementSchema,
  stockCoutSchema,
  stockNiveauSchema,
  type Mouvement,
  type StockCout,
  type StockNiveau,
} from './types'

type StockMovementKind = 'entree_achat' | 'sortie_livraison' | 'sortie_intervention' | 'entree_retour'

export interface TrackedStockMovementInput {
  articleId?: string
  depotId: string
  type: StockMovementKind
  quantity: number
  sourceLineId: string
  reference: NonNullable<Mouvement['reference']>
  numero: string
  uid: string
  auteurNom: string
  motif: string
  date: string
  unitCostCents?: number
  requireActiveDepot?: boolean
  mouvementInverseId?: string
  autoriserStockNegatif?: boolean
}

interface StockWrites {
  levels?: Array<{ reference: DocumentReference; value: StockNiveau }>
  costs?: Array<{ reference: DocumentReference; value: StockCout }>
  movements?: Array<{ reference: DocumentReference; value: Mouvement }>
}

export function writeStockTransaction(transaction: Transaction, writes: StockWrites): void {
  for (const item of writes.levels ?? []) transaction.set(item.reference, item.value)
  for (const item of writes.costs ?? []) transaction.set(item.reference, item.value)
  for (const item of writes.movements ?? []) transaction.set(item.reference, item.value)
}

export function stockSourceMovementId(reference: NonNullable<Mouvement['reference']>, sourceLineId: string): string {
  return cleSourceMouvement(reference.type, reference.id, sourceLineId)
}

function stockMovementId(input: TrackedStockMovementInput): string {
  return stockSourceMovementId(input.reference, input.sourceLineId)
}

export async function assertStockDepot(
  transaction: Transaction,
  depotId: string,
  requireActive = true,
): Promise<void> {
  const snapshot = await transaction.get(doc(db, 'depots', depotId))
  if (!snapshot.exists()) throw new Error('Le dépôt sélectionné est introuvable.')
  const depot = depotSchema.parse({ ...snapshot.data(), id: snapshot.id })
  if (requireActive && (!depot.actif || depot.archive)) {
    throw new Error('Le dépôt sélectionné est inactif ou archivé.')
  }
}

export async function applyTrackedStockMovements(
  transaction: Transaction,
  inputs: TrackedStockMovementInput[],
): Promise<void> {
  const candidates = inputs.filter((input) => input.articleId && input.quantity > 0)
  if (!candidates.length) return

  const articleRefs = new Map<string, DocumentReference>()
  const depotRefs = new Map<string, DocumentReference>()
  const levelRefs = new Map<string, DocumentReference>()
  const costRefs = new Map<string, DocumentReference>()
  const movementRefs = new Map<string, DocumentReference>()
  for (const input of candidates) {
    const articleId = input.articleId!
    articleRefs.set(articleId, doc(db, 'articles', articleId))
    depotRefs.set(input.depotId, doc(db, 'depots', input.depotId))
    const levelId = `${articleId}_${input.depotId}`
    levelRefs.set(levelId, doc(db, 'stockNiveaux', levelId))
    costRefs.set(articleId, doc(db, 'stockCouts', articleId))
    const movementId = stockMovementId(input)
    if (movementRefs.has(movementId)) throw new Error('Une ligne source est dupliquée dans ce mouvement.')
    movementRefs.set(movementId, doc(db, 'mouvements', movementId))
  }

  const refs = [
    ...articleRefs.values(),
    ...depotRefs.values(),
    ...levelRefs.values(),
    ...costRefs.values(),
    ...movementRefs.values(),
  ]
  const snapshots = await Promise.all(refs.map((reference) => transaction.get(reference)))
  const snapshotByPath = new Map(refs.map((reference, index) => [reference.path, snapshots[index]]))
  const getSnapshot = (reference: DocumentReference) => snapshotByPath.get(reference.path)!

  const articleById = new Map<string, ReturnType<typeof articleSchema.parse>>()
  for (const [articleId, reference] of articleRefs) {
    const snapshot = getSnapshot(reference)
    if (!snapshot.exists()) throw new Error(`L’article lié ${articleId} est introuvable.`)
    articleById.set(articleId, articleSchema.parse({ ...snapshot.data(), id: snapshot.id }))
  }

  const movementWrites: NonNullable<StockWrites['movements']> = []
  const levelValues = new Map<string, StockNiveau>()
  const costValues = new Map<string, StockCout>()

  for (const input of candidates) {
    const articleId = input.articleId!
    const article = articleById.get(articleId)!
    const depotReference = depotRefs.get(input.depotId)!
    const depotSnapshot = getSnapshot(depotReference)
    if (!depotSnapshot.exists()) throw new Error('Le dépôt sélectionné est introuvable.')
    const depot = depotSchema.parse({ ...depotSnapshot.data(), id: depotSnapshot.id })
    if (input.requireActiveDepot !== false && (!depot.actif || depot.archive)) {
      throw new Error('Le dépôt sélectionné est inactif ou archivé.')
    }
    if (!article.suiviStock) continue
    const movementId = stockMovementId(input)
    if (getSnapshot(movementRefs.get(movementId)!).exists()) {
      throw new Error('Cette ligne source a déjà généré un mouvement de stock.')
    }

    const levelId = `${articleId}_${input.depotId}`
    const levelReference = levelRefs.get(levelId)!
    const initialLevelSnapshot = getSnapshot(levelReference)
    const currentLevel = levelValues.get(levelId)
      ?? (initialLevelSnapshot.exists()
        ? stockNiveauSchema.parse({ ...initialLevelSnapshot.data(), id: initialLevelSnapshot.id })
        : {
            id: levelId,
            articleId,
            depotId: input.depotId,
            quantite: 0,
            codeSnapshot: article.code,
            designationSnapshot: article.designation,
            unite: article.unite,
            updatedAt: input.date,
          })

    const costReference = costRefs.get(articleId)!
    const initialCostSnapshot = getSnapshot(costReference)
    const initialCost = initialCostSnapshot.exists()
      ? stockCoutSchema.parse(initialCostSnapshot.data())
      : {
          articleId,
          pmpHT: article.prixAchatCents,
          dernierPrixAchatHT: article.prixAchatCents,
          quantiteTotale: 0,
          updatedAt: input.date,
        }
    const cost = costValues.get(articleId) ?? initialCost

    const isEntry = input.type === 'entree_achat' || input.type === 'entree_retour'
    const unitCostCents = input.type === 'entree_achat'
      ? input.unitCostCents ?? article.prixAchatCents
      : cost.pmpHT
    const movementPlan = calculerMouvement({
      type: isEntry ? 'entree' : 'sortie',
      quantite: input.quantity,
      quantiteSource: isEntry ? 0 : currentLevel.quantite,
      quantiteDestination: isEntry ? currentLevel.quantite : 0,
      quantiteTotale: cost.quantiteTotale,
      pmpHT: cost.pmpHT,
      ...(isEntry ? { coutUnitaireHT: unitCostCents } : {}),
      autoriserStockNegatif: input.autoriserStockNegatif,
    })
    const updatedLevel: StockNiveau = {
      ...currentLevel,
      quantite: isEntry ? movementPlan.quantiteDestination : movementPlan.quantiteSource,
      updatedAt: input.date,
    }
    const updatedCost: StockCout = {
      ...cost,
      pmpHT: movementPlan.pmpHT,
      dernierPrixAchatHT: isEntry ? unitCostCents : cost.dernierPrixAchatHT,
      quantiteTotale: movementPlan.quantiteTotale,
      updatedAt: input.date,
    }
    levelValues.set(levelId, updatedLevel)
    costValues.set(articleId, updatedCost)

    const reference = movementRefs.get(movementId)!
    const movement = mouvementSchema.parse({
      id: movementId,
      numero: input.numero,
      date: input.date.slice(0, 10),
      type: input.type,
      articleId,
      codeSnapshot: article.code,
      designationSnapshot: article.designation,
      unite: article.unite,
      ...(isEntry ? { depotDestinationId: input.depotId } : { depotSourceId: input.depotId }),
      quantite: input.quantity,
      ...(isEntry ? { coutUnitaireHT: unitCostCents } : {}),
      pmpAvant: cost.pmpHT,
      pmpApres: movementPlan.pmpHT,
      ...(isEntry
        ? { soldeDestinationApres: movementPlan.quantiteDestination }
        : { soldeSourceApres: movementPlan.quantiteSource }),
      reference: input.reference,
      ...(input.mouvementInverseId ? { mouvementInverseId: input.mouvementInverseId } : {}),
      motif: input.motif,
      uid: input.uid,
      auteurNom: input.auteurNom,
      annule: false,
      createdAt: input.date,
    })
    movementWrites.push({ reference, value: movement })
  }

  writeStockTransaction(transaction, {
    levels: [...levelValues].map(([id, value]) => ({ reference: levelRefs.get(id)!, value })),
    costs: [...costValues].map(([id, value]) => ({ reference: costRefs.get(id)!, value })),
    movements: movementWrites,
  })
}
