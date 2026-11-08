import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteField, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { useAuth } from '@/features/auth/authStore'
import { calculateCommercialTotals } from '@/features/commercial/calculations'
import { newHistoryEntry } from '@/features/commercial/types'
import { publicQuoteSchema, quoteSchema, type PublicQuote, type Quote, type QuoteInput, type QuoteStatus } from './types'

const quotesKey = ['commercial-quotes']

function makePublicQuote(quote: Quote, shareToken: string, status: 'sent' | 'accepted'): PublicQuote {
  const revision = quote.revisions.find((item) => item.revision === quote.sentRevision) ?? quote
  return publicQuoteSchema.parse({
    quoteId: quote.id,
    shareToken,
    number: quote.number,
    status,
    revision: quote.sentRevision ?? quote.revision,
    client: revision.client,
    lines: revision.lines,
    totals: revision.totals,
    issueDate: revision.issueDate,
    validUntil: revision.validUntil,
    notes: revision.notes,
    conditions: revision.conditions,
  })
}

async function loadQuotes(): Promise<Quote[]> {
  const snapshot = await getDocs(collection(db, 'devis'))
  return snapshot.docs.map((item) => quoteSchema.parse({ ...item.data(), id: item.id }))
}

export function useDevis(enabled = true) {
  return useQuery({ queryKey: quotesKey, queryFn: loadQuotes, enabled })
}

export function useDevisById(id: string | undefined) {
  const query = useDevis()
  return { ...query, data: query.data?.find((quote) => quote.id === id) }
}

export function useCreateDevis() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: QuoteInput) => {
      const now = new Date().toISOString()
      const number = await getNextNumber('devis')
      const reference = doc(collection(db, 'devis'))
      const quote: Quote = {
        ...input,
        id: reference.id,
        number,
        totals: calculateCommercialTotals(input.lines),
        status: 'draft',
        revision: 1,
        revisions: [],
        history: [newHistoryEntry('Création', uid)],
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      }
      await setDoc(reference, quoteSchema.parse(quote))
      return quote
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotesKey }),
  })
}

export function useAutosaveDevis() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ quote, input }: { quote: Quote; input: QuoteInput }) => {
      if (quote.status !== 'draft') throw new Error('Seul un devis brouillon peut être modifié.')
      const now = new Date().toISOString()
      const next = quoteSchema.parse({
        ...quote,
        ...input,
        totals: calculateCommercialTotals(input.lines),
        updatedAt: now,
        updatedBy: uid,
      })
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'devis', quote.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Devis introuvable.')
        const current = quoteSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status !== 'draft' || current.revision !== quote.revision) {
          throw new Error('Le devis n’est plus un brouillon modifiable. Actualisez la page.')
        }
        transaction.update(reference, {
          client: next.client,
          lines: next.lines,
          totals: next.totals,
          issueDate: next.issueDate,
          validUntil: next.validUntil,
          notes: next.notes,
          conditions: next.conditions,
          updatedAt: now,
          updatedBy: uid,
          history: [...current.history, newHistoryEntry('Brouillon modifié', uid)],
        })
      })
      return next
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotesKey }),
  })
}

export function useChangeDevisStatus() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ quote, status }: { quote: Quote; status: QuoteStatus }) => {
      const valid: Record<QuoteStatus, QuoteStatus[]> = {
        draft: ['sent'],
        sent: ['accepted', 'rejected', 'expired'],
        accepted: ['converted'],
        rejected: [],
        expired: [],
        converted: [],
      }
      if (!valid[quote.status].includes(status)) throw new Error('Cette transition de statut est interdite.')
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'devis', quote.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Devis introuvable.')
        const current = quoteSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status !== quote.status) throw new Error('Le devis a été modifié. Actualisez la page.')
        const revisions = status === 'sent' && !current.revisions.some((item) => item.revision === current.revision)
          ? [...current.revisions, {
              revision: current.revision,
              capturedAt: now,
              client: current.client,
              lines: current.lines,
              totals: current.totals,
              issueDate: current.issueDate,
              validUntil: current.validUntil,
              notes: current.notes,
              conditions: current.conditions,
            }]
          : current.revisions
        transaction.update(reference, {
          status,
          revisions,
          sentAt: status === 'sent' ? now : current.sentAt,
          sentRevision: status === 'sent' ? current.revision : current.sentRevision,
          updatedAt: now,
          updatedBy: uid,
          history: [...current.history, newHistoryEntry(status === 'sent' ? 'Envoi' : `Statut : ${status}`, uid)],
          ...(status === 'rejected' || status === 'expired'
            ? { shareToken: deleteField(), sharedAt: deleteField() }
            : {}),
        })
        if (current.shareToken) {
          const publicReference = doc(db, 'devis_partages', current.shareToken)
          if (status === 'rejected' || status === 'expired') {
            transaction.delete(publicReference)
          }
        }
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotesKey }),
  })
}

export function useReviseDevis() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (quote: Quote) => {
      if (quote.status !== 'sent' && quote.status !== 'accepted') {
        throw new Error('Seul un devis envoyé ou accepté peut faire l’objet d’une révision.')
      }
      const now = new Date().toISOString()
      return runTransaction(db, async (transaction) => {
        const reference = doc(db, 'devis', quote.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Devis introuvable.')
        const current = quoteSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status !== quote.status || current.revision !== quote.revision) {
          throw new Error('Le devis a été modifié. Actualisez la page.')
        }
        if (current.shareToken) {
          transaction.delete(doc(db, 'devis_partages', current.shareToken))
        }
        transaction.update(reference, {
          status: 'draft',
          revision: current.revision + 1,
          shareToken: deleteField(),
          sharedAt: deleteField(),
          history: [...current.history, newHistoryEntry('Nouvelle révision', uid, `Révision ${current.revision + 1}`)],
          updatedAt: now,
          updatedBy: uid,
        })
        return current.revision + 1
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotesKey }),
  })
}

export function useShareDevis() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (quote: Quote) => {
      if (quote.status !== 'sent' && quote.status !== 'accepted') {
        throw new Error('Seul un devis envoyé ou accepté peut être partagé.')
      }
      const token = crypto.randomUUID()
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'devis', quote.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Devis introuvable.')
        const current = quoteSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status !== 'sent' && current.status !== 'accepted') throw new Error('Le devis n’est plus partageable.')
        if (current.shareToken) {
          transaction.delete(doc(db, 'devis_partages', current.shareToken))
        }
        transaction.update(reference, {
          shareToken: token,
          sharedAt: now,
          updatedAt: now,
          updatedBy: uid,
          history: [...current.history, newHistoryEntry('Lien de partage créé', uid)],
        })
        transaction.set(
          doc(db, 'devis_partages', token),
          makePublicQuote(current, token, current.status),
        )
      })
      return `${window.location.origin}/devis/public/${token}`
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: quotesKey }),
  })
}

export function useQuoteStatistics() {
  const query = useDevis()
  return {
    ...query,
    data: query.data?.map(({ status, totals }) => ({
      status,
      totalTTCCents: totals.totalTTCCents,
    })),
  }
}

export async function fetchSharedQuote(token: string): Promise<PublicQuote | undefined> {
  const snapshot = await getDoc(doc(db, 'devis_partages', token))
  if (!snapshot.exists()) return undefined
  const quote = publicQuoteSchema.parse(snapshot.data())
  return quote.shareToken === token ? quote : undefined
}
