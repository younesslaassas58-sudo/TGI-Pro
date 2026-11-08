import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { useAuth } from '@/features/auth/authStore'
import { ascenseurSchema, type Ascenseur } from '@/features/parc/types'
import { generateEcheances } from './logic'
import {
  contractSchema,
  echeanceSchema,
  paiementSchema,
  relanceSchema,
  type ContratInput,
  type Echeance,
  type EcheanceInput,
  type Paiement,
  type PaymentInput,
  type RecouvrementContrat,
  type Relance,
} from './types'

const contractsKey = ['collection', 'contrats']
const échéancesKey = ['collection', 'echeances']
const paymentsKey = ['collection', 'paiements']
const remindersKey = ['collection', 'relances']

async function loadCollection<T>(
  name: string,
  parse: (value: unknown) => T,
): Promise<T[]> {
  const snapshot = await getDocs(collection(db, name))
  return snapshot.docs.map((item) => parse({ ...item.data(), id: item.id }))
}

export function useContrats(enabled = true) {
  return useQuery({
    queryKey: contractsKey,
    queryFn: () => loadCollection('contrats', contractSchema.parse),
    enabled,
  })
}

export function useEcheances(enabled = true) {
  return useQuery({
    queryKey: échéancesKey,
    queryFn: () => loadCollection('echeances', echeanceSchema.parse),
    enabled,
  })
}

export function usePaiements() {
  return useQuery({
    queryKey: paymentsKey,
    queryFn: () => loadCollection('paiements', paiementSchema.parse),
  })
}

export function useRelances() {
  return useQuery({
    queryKey: remindersKey,
    queryFn: () => loadCollection('relances', relanceSchema.parse),
  })
}

function invalidateRecouvrement(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: contractsKey })
  void client.invalidateQueries({ queryKey: échéancesKey })
  void client.invalidateQueries({ queryKey: paymentsKey })
  void client.invalidateQueries({ queryKey: remindersKey })
  void client.invalidateQueries({ queryKey: ['ascenseurs'] })
}

const parcContractLabels: Record<ContratInput['periodicite'], Ascenseur['contrat']> = {
  mensuel: 'entretien_mensuel',
  trimestriel: 'entretien_trimestriel',
  semestriel: 'entretien_semestriel',
  annuel: 'entretien_annuel',
}

export function useSaveContrat() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing }: { input: ContratInput; existing?: RecouvrementContrat }) => {
      const now = new Date().toISOString()
      const id = existing?.id ?? doc(collection(db, 'contrats')).id
      const numero = existing?.numero ?? await getNextNumber('contrat')
      const contrat = contractSchema.parse({
        ...input,
        id,
        numero,
        montantPeriodeTTC: Math.round(input.montantPeriodeHT * (1 + input.tvaPct / 100)),
        statut: input.statut,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        createdBy: existing?.createdBy ?? uid,
        updatedBy: uid,
      })
      const allElevators = await getDocs(collection(db, 'ascenseurs'))
      const related = allElevators.docs.flatMap((snapshot) => {
        const elevator = ascenseurSchema.parse({ ...snapshot.data(), id: snapshot.id })
        return (existing?.ascenseursIds.includes(elevator.id) || input.ascenseursIds.includes(elevator.id))
          ? [{ reference: snapshot.ref, elevator }]
          : []
      })
      const batch = writeBatch(db)
      batch.set(doc(db, 'contrats', id), contrat)
      for (const { reference, elevator } of related) {
        const isCurrent = input.ascenseursIds.includes(elevator.id) && input.statut === 'actif'
        batch.update(reference, {
          contrat: isCurrent ? parcContractLabels[input.periodicite] : 'aucun',
          contratDebut: isCurrent ? input.dateDebut : '',
          contratFin: isCurrent ? input.dateFin : '',
          montantContrat: isCurrent ? input.montantPeriodeHT / 100 : 0,
          updatedAt: now,
          updatedBy: uid,
        })
      }
      await batch.commit()
      return contrat
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useSetContratStatus() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ contrat, statut, motif }: {
      contrat: RecouvrementContrat
      statut: RecouvrementContrat['statut']
      motif?: string
    }) => {
      const now = new Date().toISOString()
      const snapshots = await getDocs(collection(db, 'ascenseurs'))
      const batch = writeBatch(db)
      const full = statut === 'actif'
      batch.update(doc(db, 'contrats', contrat.id), {
        statut,
        ...(statut === 'resilie' ? { dateResiliation: now.slice(0, 10), motifResiliation: motif ?? '' } : {}),
        updatedAt: now,
        updatedBy: uid,
      })
      for (const snapshot of snapshots.docs) {
        if (!contrat.ascenseursIds.includes(snapshot.id)) continue
        batch.update(snapshot.ref, {
          contrat: full ? parcContractLabels[contrat.periodicite] : 'aucun',
          contratDebut: full ? contrat.dateDebut : '',
          contratFin: full ? contrat.dateFin : '',
          montantContrat: full ? contrat.montantPeriodeHT / 100 : 0,
          updatedAt: now,
          updatedBy: uid,
        })
      }
      await batch.commit()
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useGenererEcheances() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ contrat, jusquAu }: { contrat: RecouvrementContrat; jusquAu: string }) => {
      const generated = generateEcheances(contrat, jusquAu)
      let created = 0
      let ignored = 0
      for (let offset = 0; offset < generated.length; offset += 400) {
        const chunk = generated.slice(offset, offset + 400)
        const result = await runTransaction(db, async (transaction) => {
          const references = chunk.map((item) => doc(db, 'echeances', item.id))
          const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)))
          let chunkCreated = 0
          let chunkIgnored = 0
          snapshots.forEach((snapshot, index) => {
            if (snapshot.exists()) {
              chunkIgnored += 1
              return
            }
            const now = new Date().toISOString()
            const item = echeanceSchema.parse({
              ...chunk[index],
              montantPaye: 0,
              statut: 'ouverte',
              createdAt: now,
              updatedAt: now,
              createdBy: uid,
              updatedBy: uid,
            })
            transaction.set(references[index], item)
            chunkCreated += 1
          })
          return { created: chunkCreated, ignored: chunkIgnored }
        })
        created += result.created
        ignored += result.ignored
      }
      return { created, ignored }
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useGenererEcheancesActives() {
  const { data: contrats = [] } = useContrats()
  const generate = useGenererEcheances()
  return useMutation({
    mutationFn: async (jusquAu: string) => {
      const actives = contrats.filter((item) => item.statut === 'actif' && !item.archive)
      const counts = await Promise.all(actives.map((contrat) => generate.mutateAsync({ contrat, jusquAu })))
      return counts.reduce((total, item) => ({
        created: total.created + item.created,
        ignored: total.ignored + item.ignored,
      }), { created: 0, ignored: 0 })
    },
  })
}

export function useCreateEcheance() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: EcheanceInput) => {
      const now = new Date().toISOString()
      const reference = doc(collection(db, 'echeances'))
      const echeance = echeanceSchema.parse({
        ...input,
        id: reference.id,
        montantPaye: 0,
        statut: 'ouverte',
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      })
      await setDoc(reference, echeance)
      return echeance
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useCancelEcheance() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ echeance, motif }: { echeance: Echeance; motif: string }) => {
      if (!motif.trim()) throw new Error('Indiquez le motif de l’annulation.')
      if (echeance.montantPaye !== 0) throw new Error('Une échéance ayant reçu un paiement ne peut pas être annulée.')
      await updateDoc(doc(db, 'echeances', echeance.id), {
        statut: 'annulee',
        notes: [echeance.notes, `Annulation : ${motif.trim()}`].filter(Boolean).join('\n'),
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      })
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useEnregistrerPaiement() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: PaymentInput) => {
      const totalAffecte = input.affectations.reduce((sum, item) => sum + item.montant, 0)
      const echeanceIds = new Set(input.affectations.map((item) => item.echeanceId))
      if (input.montant <= 0 || totalAffecte !== input.montant) {
        throw new Error('Le montant reçu doit correspondre exactement au total affecté. Les avances ne sont pas gérées.')
      }
      if (echeanceIds.size !== input.affectations.length) {
        throw new Error('Une échéance ne peut recevoir qu’une seule affectation par paiement.')
      }
      const numero = await getNextNumber('recu')
      const reference = doc(collection(db, 'paiements'))
      const now = new Date().toISOString()
      const paiement = paiementSchema.parse({
        ...input,
        id: reference.id,
        numero,
        annule: false,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      })
      await runTransaction(db, async (transaction) => {
        const echeanceReferences = input.affectations.map((item) => doc(db, 'echeances', item.echeanceId))
        const snapshots = await Promise.all(echeanceReferences.map((item) => transaction.get(item)))
        const updates = snapshots.map((snapshot, index) => {
          if (!snapshot.exists()) throw new Error('Une échéance sélectionnée est introuvable.')
          const current = echeanceSchema.parse({ ...snapshot.data(), id: snapshot.id })
          const allocation = input.affectations[index]
          if (current.clientId !== input.clientId || current.statut !== 'ouverte') {
            throw new Error('Une échéance ne peut plus recevoir ce paiement.')
          }
          const remaining = current.montantTTC - current.montantPaye
          if (allocation.montant > remaining) {
            throw new Error(`Le montant affecté à « ${current.libelle} » dépasse le solde de ${remaining} centimes.`)
          }
          const paid = current.montantPaye + allocation.montant
          return {
            reference: echeanceReferences[index],
            montantPaye: paid,
            statut: paid === current.montantTTC ? 'soldee' as const : 'ouverte' as const,
          }
        })
        transaction.set(reference, paiement)
        for (const update of updates) {
          transaction.update(update.reference, {
            montantPaye: update.montantPaye,
            statut: update.statut,
            updatedAt: now,
            updatedBy: uid,
          })
        }
      })
      return paiement
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useAnnulerPaiement() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ paiement, motif }: { paiement: Paiement; motif: string }) => {
      if (!motif.trim()) throw new Error('Indiquez le motif de l’annulation.')
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const paymentReference = doc(db, 'paiements', paiement.id)
        const paymentSnapshot = await transaction.get(paymentReference)
        if (!paymentSnapshot.exists()) throw new Error('Paiement introuvable.')
        const currentPayment = paiementSchema.parse({ ...paymentSnapshot.data(), id: paymentSnapshot.id })
        if (currentPayment.annule) throw new Error('Ce paiement est déjà annulé.')
        const amountsByDue = new Map<string, number>()
        for (const allocation of currentPayment.affectations) {
          amountsByDue.set(allocation.echeanceId, (amountsByDue.get(allocation.echeanceId) ?? 0) + allocation.montant)
        }
        const references = [...amountsByDue.keys()].map((id) => doc(db, 'echeances', id))
        const snapshots = await Promise.all(references.map((reference) => transaction.get(reference)))
        const updates = snapshots.map((snapshot, index) => {
          if (!snapshot.exists()) throw new Error('Une échéance liée au paiement est introuvable.')
          const current = echeanceSchema.parse({ ...snapshot.data(), id: snapshot.id })
          if (current.clientId !== currentPayment.clientId) {
            throw new Error('Une échéance liée au paiement appartient à un autre client.')
          }
          const paid = current.montantPaye - (amountsByDue.get(snapshot.id) ?? 0)
          if (paid < 0) throw new Error('Le cumul payé est incohérent ; annulation refusée.')
          return { reference: references[index], paid, status: paid === current.montantTTC ? 'soldee' as const : 'ouverte' as const }
        })
        transaction.update(paymentReference, {
          annule: true,
          motifAnnulation: motif.trim(),
          annulePar: uid,
          annuleLe: now,
          updatedAt: now,
          updatedBy: uid,
        })
        for (const update of updates) {
          transaction.update(update.reference, {
            montantPaye: update.paid,
            statut: update.status,
            updatedAt: now,
            updatedBy: uid,
          })
        }
      })
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}

export function useCreateRelance() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: Omit<Relance, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => {
      const reference = doc(collection(db, 'relances'))
      const now = new Date().toISOString()
      const relance = relanceSchema.parse({
        ...input,
        id: reference.id,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      })
      await setDoc(reference, relance)
      return relance
    },
    onSuccess: () => invalidateRecouvrement(queryClient),
  })
}
