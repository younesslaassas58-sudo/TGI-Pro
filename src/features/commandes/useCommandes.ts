import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDocs, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getNextNumber } from '@/features/documents/getNextNumber'
import {
  applyFulfillmentIncrements,
  calculateCommercialTotals,
  fulfillmentStatus,
} from '@/features/commercial/calculations'
import { assertQuoteCanBeConverted, createClientOrderFromQuote } from '@/features/commercial/orderConversion'
import { newHistoryEntry } from '@/features/commercial/types'
import { useAuth } from '@/features/auth/authStore'
import { applyTrackedStockMovements, assertStockDepot } from '@/features/stock/transactions'
import { quoteSchema } from '@/features/devis/types'
import { orderSchema, type Order, type OrderInput } from './types'

const ordersKey = ['commercial-orders']

async function loadOrders(): Promise<Order[]> {
  const snapshot = await getDocs(collection(db, 'bonsCommande'))
  return snapshot.docs.map((item) => orderSchema.parse({ ...item.data(), id: item.id }))
}

export function useCommandes() {
  return useQuery({ queryKey: ordersKey, queryFn: loadOrders })
}

export function useCommande(id: string | undefined) {
  const query = useCommandes()
  return { ...query, data: query.data?.find((order) => order.id === id) }
}

export function useCreateCommande() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (input: OrderInput) => {
      const now = new Date().toISOString()
      const number = await getNextNumber(
        input.kind === 'client' ? 'bon_commande_client' : 'bon_commande_fournisseur',
      )
      const reference = doc(collection(db, 'bonsCommande'))
      const order: Order = {
        ...input,
        id: reference.id,
        number,
        lines: input.lines.map((line) => ({ ...line, orderedQuantity: line.quantity, fulfilledQuantity: 0 })),
        totals: calculateCommercialTotals(input.lines),
        status: 'ordered',
        history: [newHistoryEntry('Commande créée', uid)],
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      }
      await setDoc(reference, orderSchema.parse(order))
      return order
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKey }),
  })
}

export function useConvertDevisToCommande() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const number = await getNextNumber('bon_commande_client')
      const newOrderRef = doc(collection(db, 'bonsCommande'))
      const now = new Date().toISOString()
      const result = await runTransaction(db, async (transaction) => {
        const quoteRef = doc(db, 'devis', quoteId)
        const quoteSnapshot = await transaction.get(quoteRef)
        if (!quoteSnapshot.exists()) throw new Error('Devis introuvable.')
        const quote = quoteSchema.parse({ ...quoteSnapshot.data(), id: quoteSnapshot.id })
        assertQuoteCanBeConverted(quote)
        const order = createClientOrderFromQuote(quote, newOrderRef.id, number, now, uid)
        transaction.set(newOrderRef, orderSchema.parse(order))
        transaction.update(quoteRef, {
          status: 'converted',
          convertedOrderId: newOrderRef.id,
          updatedAt: now,
          updatedBy: uid,
          history: [...quote.history, newHistoryEntry('Converti en commande', uid, order.number)],
        })
        return newOrderRef.id
      })
      return result
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersKey })
      void queryClient.invalidateQueries({ queryKey: ['commercial-quotes'] })
    },
  })
}

export function useUpdateCommandeStatus() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ order, status }: { order: Order; status: Order['status'] }) => {
      if (status !== 'cancelled') throw new Error('Transition de commande non prise en charge.')
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'bonsCommande', order.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Commande introuvable.')
        const current = orderSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status === 'cancelled' || current.status === 'received') {
          throw new Error('Cette commande ne peut plus être modifiée.')
        }
        if (current.lines.some((line) => line.fulfilledQuantity > 0)) {
          throw new Error('Une commande partiellement traitée ne peut pas être annulée ici.')
        }
        transaction.update(reference, {
          status,
          updatedAt: now,
          updatedBy: uid,
          history: [...current.history, newHistoryEntry(`Statut : ${status}`, uid)],
        })
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordersKey }),
  })
}

export function useRecordSupplierReceipt() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async ({ orderId, quantities, depotId, receiptId }: {
      orderId: string
      quantities: Record<string, number>
      depotId: string
      receiptId: string
    }) => {
      if (!depotId) throw new Error('Sélectionnez le dépôt de réception.')
      if (!receiptId) throw new Error('Identifiant de réception manquant.')
      const movementNumbers = new Map<string, string>()
      for (const [lineId, quantity] of Object.entries(quantities)) {
        if (quantity > 0) movementNumbers.set(lineId, await getNextNumber('mouvement_stock'))
      }
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'bonsCommande', orderId)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Commande introuvable.')
        const order = orderSchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (order.history.some((entry) => entry.id === receiptId)) {
          throw new Error('Cette réception a déjà été enregistrée.')
        }
        if (order.kind !== 'fournisseur' || order.status === 'cancelled' || order.status === 'received') {
          throw new Error('Cette commande fournisseur ne peut plus être réceptionnée.')
        }
        const validLineIds = new Set(order.lines.map((line) => line.id))
        if (Object.keys(quantities).some((lineId) => !validLineIds.has(lineId))) {
          throw new Error('La réception contient une ligne qui n’appartient pas à cette commande.')
        }
        if (Object.values(quantities).some((quantity) => !Number.isFinite(quantity) || quantity < 0)) {
          throw new Error('Les quantités reçues doivent être des nombres positifs ou nuls.')
        }
        if (!Object.values(quantities).some((quantity) => quantity > 0)) throw new Error('Saisissez au moins une quantité reçue.')
        const increments = Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([orderLineId, quantity]) => ({ orderLineId, quantity }))
        const lines = applyFulfillmentIncrements(order.lines, increments)
        const complete = fulfillmentStatus(lines) === 'received'
        const lineById = new Map(order.lines.map((line) => [line.id, line]))
        const stockMovements = increments.flatMap(({ orderLineId, quantity }) => {
          const line = lineById.get(orderLineId)!
          return line.articleId ? [{
            articleId: line.articleId,
            depotId,
            type: 'entree_achat' as const,
            quantity,
            sourceLineId: `${receiptId}_${orderLineId}`,
            reference: { type: 'bon_commande_fournisseur', id: order.id },
            numero: movementNumbers.get(orderLineId)!,
            uid,
            auteurNom: profile?.displayName || profile?.email || uid,
            motif: `Réception de la commande fournisseur ${order.number}`,
            date: now,
            unitCostCents: line.unitPriceCents,
          }] : []
        })
        await assertStockDepot(transaction, depotId)
        await applyTrackedStockMovements(transaction, stockMovements)
        transaction.update(reference, {
          lines,
          status: complete ? 'received' : 'partially_received',
          updatedAt: now,
          updatedBy: uid,
          history: [...order.history, {
            id: receiptId,
            action: 'Réception fournisseur enregistrée',
            at: now,
            by: uid,
            details: '',
          }],
        })
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersKey })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}
