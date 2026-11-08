import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { apiPost } from '@/lib/api'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { ascenseurSchema } from '@/features/parc/types'
import { applyTrackedStockMovements, stockSourceMovementId } from '@/features/stock/transactions'
import { mouvementSchema } from '@/features/stock/types'
import { contractSchema } from '@/features/recouvrement/types'
import { assertTransition, filterExistingMonthlyVisitKeys, monthlyPlanKey } from './logic'
import {
  interventionMediaSchema,
  interventionSchema,
  type Intervention,
  type InterventionInput,
  type InterventionMedia,
  type InterventionStatus,
} from './types'

const interventionsKey = ['interventions']
const mediaKey = ['intervention-medias']

async function loadInterventions(uid: string, role: string | undefined): Promise<Intervention[]> {
  const ref = collection(db, 'interventions')
  const snapshot = role === 'technicien'
    ? await getDocs(query(ref, where('techniciensUids', 'array-contains', uid)))
    : await getDocs(ref)
  return snapshot.docs.map((item) => interventionSchema.parse({ ...item.data(), id: item.id }))
}

export function useInterventions() {
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const role = useAuth((state) => state.profile?.role)
  return useQuery({
    queryKey: [...interventionsKey, role, uid],
    queryFn: () => loadInterventions(uid, role),
    enabled: Boolean(uid && role),
  })
}

export function useIntervention(id: string | undefined) {
  const query = useInterventions()
  return { ...query, data: query.data?.find((item) => item.id === id) }
}

async function loadMedias(interventionId: string): Promise<InterventionMedia[]> {
  const snapshot = await getDocs(collection(db, 'interventions', interventionId, 'medias'))
  return snapshot.docs.map((item) => interventionMediaSchema.parse({ ...item.data(), id: item.id }))
}

export function useInterventionMedias(id: string | undefined) {
  return useQuery({
    queryKey: [...mediaKey, id],
    queryFn: () => id ? loadMedias(id) : Promise.resolve([]),
    enabled: Boolean(id),
  })
}

function invalidateInterventions(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: interventionsKey })
  void client.invalidateQueries({ queryKey: ['ascenseurs'] })
  void client.invalidateQueries({ queryKey: ['stock'] })
  void client.invalidateQueries({ queryKey: mediaKey })
  void client.invalidateQueries({ queryKey: ['collection', 'contrats'] })
}

export function useCreateIntervention() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  const profile = useAuth((state) => state.profile)
  const canCreate = usePermission('interventions', 'creer')
  return useMutation({
    mutationFn: async (input: InterventionInput) => {
      if (!user || !profile) throw new Error('Session utilisateur indisponible.')
      if (!canCreate) throw new Error('Vous ne pouvez pas créer une intervention.')
      const number = await getNextNumber('intervention')
      const id = doc(collection(db, 'interventions')).id
      const now = new Date().toISOString()
      const record = interventionSchema.parse({
        ...input,
        id,
        numero: number,
        statut: input.datePrevue ? 'planifiee' : 'nouvelle',
        techniciensIds: [...new Set(input.techniciensIds)],
        techniciensUids: [...new Set(input.techniciensUids)],
        technicienPrincipalId: input.technicienPrincipalId,
        mouvementsStockGeneres: false,
        historiqueStatuts: [{
          statut: input.datePrevue ? 'planifiee' : 'nouvelle',
          date: now,
          uid: user.uid,
          nom: profile.displayName || profile.email,
        }],
        archive: false,
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
        updatedBy: user.uid,
      })
      await setDoc(doc(db, 'interventions', id), record)
      return record
    },
    onSuccess: () => invalidateInterventions(client),
  })
}

export function useSaveIntervention() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  const profile = useAuth((state) => state.profile)
  const canEdit = usePermission('interventions', 'modifier')
  return useMutation({
    mutationFn: async ({ input, existing }: { input: InterventionInput; existing?: Intervention }) => {
      if (!user || !profile) throw new Error('Session utilisateur indisponible.')
      const now = new Date().toISOString()
      if (!existing) throw new Error('Utilisez la création pour une nouvelle intervention.')
      const assignedTechnician = profile.role === 'technicien' && existing.techniciensUids.includes(user.uid)
      if (!canEdit && !assignedTechnician) throw new Error('Vous ne pouvez pas modifier cette intervention.')
      if (['terminee', 'cloturee', 'annulee'].includes(existing.statut)) {
        throw new Error('Une intervention terminée ou annulée ne peut plus être modifiée depuis ce formulaire.')
      }
      if (assignedTechnician) {
        await updateDoc(doc(db, 'interventions', existing.id), {
          diagnostic: input.diagnostic,
          travauxRealises: input.travauxRealises,
          piecesUtilisees: input.piecesUtilisees,
          checklist: input.checklist,
          observations: input.observations,
          recommandations: input.recommandations,
          etatApresIntervention: input.etatApresIntervention,
          nomSignataire: input.nomSignataire,
          updatedAt: now,
          updatedBy: user.uid,
        })
        return existing.id
      }
      const updated = interventionSchema.parse({
        ...existing,
        ...input,
        id: existing.id,
        numero: existing.numero,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
        updatedAt: now,
        updatedBy: user.uid,
      })
      await updateDoc(doc(db, 'interventions', existing.id), { ...updated })
      return updated
    },
    onSuccess: () => invalidateInterventions(client),
  })
}

export function useChangeInterventionStatus() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  const profile = useAuth((state) => state.profile)
  const canManage = usePermission('interventions', 'modifier')
  return useMutation({
    mutationFn: async (input: {
      intervention: Intervention
      statut: InterventionStatus
      annulation?: string
      technicienDepotId?: string
    }) => {
      if (!user || !profile) throw new Error('Session utilisateur indisponible.')
      const { intervention, statut } = input
      if (profile.role === 'technicien'
        && !intervention.techniciensUids.includes(user.uid)) {
        throw new Error('Cette intervention ne vous est pas assignée.')
      }
      if (profile.role !== 'technicien' && !canManage) throw new Error('Vous ne pouvez pas modifier cette intervention.')
      if (['terminee', 'cloturee', 'annulee'].includes(intervention.statut) && profile.role !== 'directeur') {
        throw new Error('Seul le directeur peut modifier une intervention terminée, clôturée ou annulée.')
      }
      assertTransition(intervention.statut, statut)
      if (statut === 'annulee' && !input.annulation?.trim()) throw new Error('Le motif d’annulation est obligatoire.')
      if (statut === 'terminee') {
        await apiPost('/api/interventions/complete', {
          interventionId: intervention.id,
          ...(input.technicienDepotId ? { depotId: input.technicienDepotId } : {}),
        })
        return statut
      }

      const now = new Date().toISOString()
      const interventionRef = doc(db, 'interventions', intervention.id)
      if (!(statut === 'annulee' && intervention.mouvementsStockGeneres)) {
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(interventionRef)
          if (!snapshot.exists()) throw new Error('Intervention introuvable.')
          const current = interventionSchema.parse({ ...snapshot.data(), id: snapshot.id })
          assertTransition(current.statut, statut)
          const history = [...current.historiqueStatuts, {
            statut,
            date: now,
            uid: user.uid,
            nom: profile.displayName || profile.email,
          }]
          transaction.update(interventionRef, {
            statut,
            ...(statut === 'en_cours' && !current.dateDebutReelle ? { dateDebutReelle: now } : {}),
            ...(statut === 'annulee' ? { annulation: input.annulation?.trim() } : {}),
            historiqueStatuts: history,
            updatedAt: now,
            updatedBy: user.uid,
          })
        })
        return statut
      }

      const lineIds = intervention.piecesUtilisees.filter((part) => part.articleId && part.quantite > 0)
      const movementNumbers = new Map<string, string>()
      if (intervention.mouvementsStockGeneres) {
        for (const part of lineIds) movementNumbers.set(part.id, await getNextNumber('mouvement_stock'))
      }

      await runTransaction(db, async (transaction) => {
        const currentSnapshot = await transaction.get(interventionRef)
        if (!currentSnapshot.exists()) throw new Error('Intervention introuvable.')
        const current = interventionSchema.parse({ ...currentSnapshot.data(), id: currentSnapshot.id })
        assertTransition(current.statut, statut)
        if (!current.mouvementsStockGeneres) throw new Error('Aucun mouvement de stock n’a été généré pour cette intervention.')
        if (statut === 'annulee') {
          const originals: Array<{ ref: ReturnType<typeof doc>; line: typeof lineIds[number] }> = []
          for (const part of current.piecesUtilisees.filter((item) => item.articleId && item.quantite > 0)) {
            const movementRef = doc(db, 'mouvements', stockSourceMovementId(
              { type: 'intervention', id: current.id, interventionId: current.id },
              part.id,
            ))
            originals.push({ ref: movementRef, line: part })
          }
          const snapshots = await Promise.all(originals.map(({ ref }) => transaction.get(ref)))
          const reverseInputs = originals.flatMap(({ line }, index) => {
            const original = snapshots[index]
            if (!original?.exists() || original.data().annule) return []
            const movement = mouvementSchema.parse({ ...original.data(), id: original.id })
            if (!movement.depotSourceId) return []
            return [{
              articleId: line.articleId!,
              depotId: movement.depotSourceId,
              type: 'entree_retour' as const,
              quantity: line.quantite,
              sourceLineId: `annulation_${line.id}`,
              reference: { type: 'annulation_intervention', id: current.id, interventionId: current.id },
              numero: movementNumbers.get(line.id) ?? '',
              uid: user.uid,
              auteurNom: profile.displayName || profile.email,
              motif: `Annulation de l’intervention ${current.numero}`,
              date: now,
              mouvementInverseId: movement.id,
            }]
          })
          if (reverseInputs.length) {
            await applyTrackedStockMovements(transaction, reverseInputs)
            snapshots.forEach((snapshot, index) => {
              if (snapshot?.exists() && !snapshot.data().annule) {
                transaction.update(originals[index].ref, { annule: true, mouvementInverseId: stockSourceMovementId(
                  { type: 'annulation_intervention', id: current.id, interventionId: current.id },
                  `annulation_${originals[index].line.id}`,
                ) })
              }
            })
          }
        }

        const history = [...current.historiqueStatuts, {
          statut,
          date: now,
          uid: user.uid,
          nom: profile.displayName || profile.email,
        }]
        transaction.update(interventionRef, {
          statut,
          annulation: input.annulation?.trim(),
          historiqueStatuts: history,
          updatedAt: now,
          updatedBy: user.uid,
        })
      })
      return statut
    },
    onSuccess: () => invalidateInterventions(client),
  })
}

export function useSaveInterventionMedia() {
  const client = useQueryClient()
  const user = useAuth((state) => state.user)
  return useMutation({
    mutationFn: async ({ interventionId, file, type }: { interventionId: string; file: File; type: InterventionMedia['type'] }) => {
      if (!user) throw new Error('Session utilisateur indisponible.')
      const intervention = await getDoc(doc(db, 'interventions', interventionId))
      if (!intervention.exists()) throw new Error('Intervention introuvable.')
      const photoCount = await getDocs(query(
        collection(db, 'interventions', interventionId, 'medias'),
        where('type', 'in', ['photo_avant', 'photo_apres']),
      ))
      if (type !== 'signature' && photoCount.size >= 6) throw new Error('Six photos maximum par intervention.')
      const { compressInterventionImage } = await import('./media')
      const dataUrl = await compressInterventionImage(file)
      if (new Blob([dataUrl]).size > 200 * 1024) throw new Error('La photo compressée dépasse 200 Ko.')
      const id = crypto.randomUUID()
      const media = interventionMediaSchema.parse({
        id, dataUrl, type, createdAt: new Date().toISOString(), createdBy: user.uid,
      })
      const batch = writeBatch(db)
      batch.set(doc(db, 'interventions', interventionId, 'medias', id), media)
      if (type === 'signature') {
        batch.update(doc(db, 'interventions', interventionId), { signatureMediaId: id })
      } else {
        batch.update(doc(db, 'interventions', interventionId), {
          photosMediaIds: [...((intervention.data().photosMediaIds as string[] | undefined) ?? []), id],
        })
      }
      await batch.commit()
      return media
    },
    onSuccess: () => invalidateInterventions(client),
  })
}

export function useDeleteIntervention() {
  const client = useQueryClient()
  const canDelete = usePermission('interventions', 'supprimer')
  return useMutation({
    mutationFn: async (intervention: Intervention) => {
      if (!canDelete) throw new Error('Seul le directeur peut supprimer une intervention.')
      await deleteDoc(doc(db, 'interventions', intervention.id))
    },
    onSuccess: () => invalidateInterventions(client),
  })
}

export function useGenerateMonthlyVisits() {
  const client = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async (month: string) => {
      if (!['directeur', 'commercial'].includes(profile?.role ?? '')) throw new Error('Vous ne pouvez pas générer les visites.')
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choisissez un mois valide.')
      const [contractsSnap, elevatorsSnap, interventionsSnap] = await Promise.all([
        getDocs(collection(db, 'contrats')),
        getDocs(collection(db, 'ascenseurs')),
        getDocs(collection(db, 'interventions')),
      ])
      const contracts = contractsSnap.docs.map((item) => contractSchema.parse({ ...item.data(), id: item.id }))
      const elevators = elevatorsSnap.docs.map((item) => ascenseurSchema.parse({ ...item.data(), id: item.id }))
      const existing = interventionsSnap.docs.map((item) => interventionSchema.parse({ ...item.data(), id: item.id }))
      const existingKeys = new Set(existing.map((item) => item.planificationKey).filter((key): key is string => Boolean(key)))
      const candidates = contracts.filter((item) => item.statut === 'actif' && !item.archive
        && item.dateDebut.slice(0, 7) <= month && item.dateFin.slice(0, 7) >= month)
        .flatMap((contract) => contract.ascenseursIds.flatMap((elevatorId) => {
          const elevator = elevators.find((item) => item.id === elevatorId)
          return elevator?.prochaineVisite.slice(0, 7) === month
            ? [{ contract, elevator, month }]
            : []
        }))
      const uniqueCandidates = filterExistingMonthlyVisitKeys(existingKeys, candidates.map(({ contract, elevator }) => ({
        contratId: contract.id, ascenseurId: elevator.id, month,
      })))
      const byKey = new Map(candidates.map(({ contract, elevator }) => [monthlyPlanKey(contract.id, elevator.id, month), { contract, elevator }]))
      const prepared = await Promise.all(uniqueCandidates.map(async ({ contratId, ascenseurId }) => {
        const key = monthlyPlanKey(contratId, ascenseurId, month)
        const candidate = byKey.get(key)
        if (!candidate) return undefined
        const { contract, elevator } = candidate
        const number = await getNextNumber('intervention')
        return {
          id: encodeURIComponent(key),
          number,
          key,
          contract,
          elevator,
        }
      }))
      const records = prepared.filter((item): item is NonNullable<typeof item> => Boolean(item))
      if (!records.length) return { count: 0, month }
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const refs = records.map((item) => doc(db, 'interventions', item.id))
        const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)))
        records.forEach((item, index) => {
          if (snapshots[index].exists()) return
          const record = interventionSchema.parse({
            id: item.id,
            numero: item.number,
            type: 'entretien',
            priorite: 'normale',
            statut: 'planifiee',
            clientId: item.contract.clientId,
            clientNomSnapshot: item.contract.client.nom,
            ascenseurId: item.elevator.id,
            ascenseurCodeSnapshot: item.elevator.code,
            adresseSiteSnapshot: [item.elevator.adresseSite, item.elevator.villeSite].filter(Boolean).join(', '),
            contratId: item.contract.id,
            techniciensIds: [],
            techniciensUids: [],
            technicienPrincipalId: '',
            canalDemande: 'contrat',
            demandeur: { nom: item.contract.client.nom, telephone: item.contract.client.telephone },
            personneBloquee: false,
            descriptionDemande: `Visite d’entretien planifiée pour ${month}.`,
            datePrevue: item.elevator.prochaineVisite,
            heurePrevue: '',
            tempsDeplacementMinutes: 0,
            diagnostic: '',
            travauxRealises: '',
            piecesUtilisees: [],
            mouvementsStockGeneres: false,
            checklist: [],
            observations: '',
            recommandations: '',
            etatApresIntervention: 'en_service',
            facturable: false,
            couvertParContrat: true,
            montantEstime: 0,
            nomSignataire: '',
            photosMediaIds: [],
            historiqueStatuts: [{ statut: 'planifiee', date: now, uid, nom: profile?.displayName || profile?.email || '' }],
            archive: false,
            planificationKey: item.key,
            createdAt: now,
            updatedAt: now,
            createdBy: uid,
            updatedBy: uid,
          })
          transaction.set(refs[index], record)
        })
      })
      return { count: records.length, month }
    },
    onSuccess: () => invalidateInterventions(client),
  })
}
