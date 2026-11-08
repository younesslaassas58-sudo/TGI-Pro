import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDocs, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { compressProfilePhoto } from '@/lib/compressProfilePhoto'
import { getNextNumber } from '@/features/documents/getNextNumber'
import {
  applyFulfillmentIncrements,
  fulfillmentStatus,
  restoreFulfillmentIncrements,
} from '@/features/commercial/calculations'
import { newHistoryEntry } from '@/features/commercial/types'
import { useAuth } from '@/features/auth/authStore'
import {
  applyTrackedStockMovements,
  assertStockDepot,
  stockSourceMovementId,
} from '@/features/stock/transactions'
import { orderSchema, type Order } from '@/features/commandes/types'
import { deliverySchema, type Delivery, type DeliveryInput } from './types'

const deliveriesKey = ['commercial-deliveries']
const ordersKey = ['commercial-orders']
const MAX_MEDIA_COUNT = 5
const MAX_MEDIA_TOTAL_BYTES = 450 * 1024
const MAX_SIGNATURE_BYTES = 150 * 1024

async function loadDeliveries(): Promise<Delivery[]> {
  const snapshot = await getDocs(collection(db, 'bonsLivraison'))
  return snapshot.docs.map((item) => deliverySchema.parse({ ...item.data(), id: item.id }))
}

export function useLivraisons() {
  return useQuery({ queryKey: deliveriesKey, queryFn: loadDeliveries })
}

export function useLivraison(id: string | undefined) {
  const query = useLivraisons()
  return { ...query, data: query.data?.find((delivery) => delivery.id === id) }
}

export function useCreateLivraison() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async (input: DeliveryInput) => {
      if (!input.depotId) throw new Error('Sélectionnez le dépôt de sortie.')
      if (input.signatureDataUrl && new Blob([input.signatureDataUrl]).size > MAX_SIGNATURE_BYTES) {
        throw new Error('La signature dépasse la taille maximale autorisée.')
      }
      const number = await getNextNumber('bon_livraison')
      const movementNumbers = new Map<string, string>()
      for (const line of input.lines) {
        if (!movementNumbers.has(line.id)) movementNumbers.set(line.id, await getNextNumber('mouvement_stock'))
      }
      const now = new Date().toISOString()
      const deliveryRef = doc(collection(db, 'bonsLivraison'))
      const deliveryId = await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'bonsCommande', input.orderId)
        const orderSnapshot = await transaction.get(orderRef)
        if (!orderSnapshot.exists()) throw new Error('Commande introuvable.')
        const order = orderSchema.parse({ ...orderSnapshot.data(), id: orderSnapshot.id })
        if (order.kind !== 'client') throw new Error('Une livraison client doit être liée à une commande client.')
        if (order.status === 'cancelled' || order.status === 'received') throw new Error('Cette commande ne peut plus être livrée.')
        if (!input.lines.length) throw new Error('Ajoutez au moins une ligne à livrer.')
        const lines = applyFulfillmentIncrements(order.lines, input.lines)
        const fullyDelivered = fulfillmentStatus(lines) === 'received'
        const delivery: Delivery = {
          id: deliveryRef.id,
          number,
          orderId: order.id,
          orderNumber: order.number,
          depotId: input.depotId,
          client: order.party,
          lines: input.lines,
          status: 'delivered',
          deliveredAt: now,
          signedBy: input.signedBy,
          ...(input.signatureDataUrl ? { signatureDataUrl: input.signatureDataUrl } : {}),
          media: [],
          notes: input.notes,
          history: [newHistoryEntry('Livraison enregistrée', uid)],
          createdAt: now,
          updatedAt: now,
          createdBy: uid,
          updatedBy: uid,
        }
        const orderLinesById = new Map(order.lines.map((line) => [line.id, line]))
        const stockMovements = input.lines.flatMap((deliveryLine) => {
          const orderLine = orderLinesById.get(deliveryLine.orderLineId)
          return orderLine?.articleId ? [{
            articleId: orderLine.articleId,
            depotId: input.depotId,
            type: 'sortie_livraison' as const,
            quantity: deliveryLine.quantity,
            sourceLineId: deliveryLine.id,
            reference: { type: 'bon_livraison', id: deliveryRef.id },
            numero: movementNumbers.get(deliveryLine.id)!,
            uid,
            auteurNom: profile?.displayName || profile?.email || uid,
            motif: `Livraison ${number}`,
            date: now,
          }] : []
        })
        await assertStockDepot(transaction, input.depotId)
        await applyTrackedStockMovements(transaction, stockMovements)
        transaction.set(deliveryRef, deliverySchema.parse(delivery))
        transaction.update(orderRef, {
          lines,
          status: fullyDelivered ? 'received' : 'partially_received',
          updatedAt: now,
          updatedBy: uid,
          history: [...order.history, newHistoryEntry('Livraison enregistrée', uid, number)],
        })
        return delivery.id
      })
      return deliveryId
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deliveriesKey })
      void queryClient.invalidateQueries({ queryKey: ordersKey })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export function useCancelLivraison() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const profile = useAuth((state) => state.profile)
  return useMutation({
    mutationFn: async (delivery: Delivery) => {
      const movementNumbers = new Map<string, string>()
      for (const line of delivery.lines) {
        if (!movementNumbers.has(line.id)) movementNumbers.set(line.id, await getNextNumber('mouvement_stock'))
      }
      const now = new Date().toISOString()
      await runTransaction(db, async (transaction) => {
        const deliveryRef = doc(db, 'bonsLivraison', delivery.id)
        const deliverySnapshot = await transaction.get(deliveryRef)
        if (!deliverySnapshot.exists()) throw new Error('Bon de livraison introuvable.')
        const current = deliverySchema.parse({ ...deliverySnapshot.data(), id: deliverySnapshot.id })
        if (current.status !== 'delivered') throw new Error('Ce bon est déjà annulé.')
        const orderRef = doc(db, 'bonsCommande', current.orderId)
        const orderSnapshot = await transaction.get(orderRef)
        if (!orderSnapshot.exists()) throw new Error('La commande liée est introuvable.')
        const order = orderSchema.parse({ ...orderSnapshot.data(), id: orderSnapshot.id })
        if (current.depotId) {
          await assertStockDepot(transaction, current.depotId, false)
          const orderLinesById = new Map(order.lines.map((line) => [line.id, line]))
          const stockMovements = current.lines.flatMap((deliveryLine) => {
            const orderLine = orderLinesById.get(deliveryLine.orderLineId)
            return orderLine?.articleId ? [{
              articleId: orderLine.articleId,
              depotId: current.depotId,
              type: 'entree_retour' as const,
              quantity: deliveryLine.quantity,
              sourceLineId: deliveryLine.id,
              reference: { type: 'annulation_bon_livraison', id: current.id },
              numero: movementNumbers.get(deliveryLine.id)!,
              uid,
              auteurNom: profile?.displayName || profile?.email || uid,
              motif: `Annulation du bon de livraison ${current.number}`,
              date: now,
              requireActiveDepot: false,
              mouvementInverseId: stockSourceMovementId(
                { type: 'bon_livraison', id: current.id },
                deliveryLine.id,
              ),
            }] : []
          })
          await applyTrackedStockMovements(transaction, stockMovements)
        }
        const lines = restoreFulfillmentIncrements(
          order.lines,
          current.lines.map(({ orderLineId, quantity }) => ({ orderLineId, quantity })),
        )
        const status = fulfillmentStatus(lines)
        transaction.update(deliveryRef, {
          status: 'cancelled',
          updatedAt: now,
          updatedBy: uid,
          history: [...current.history, newHistoryEntry('Livraison annulée', uid)],
        })
        transaction.update(orderRef, {
          lines,
          status,
          updatedAt: now,
          updatedBy: uid,
          history: [...order.history, newHistoryEntry('Livraison annulée et quantités restaurées', uid, current.number)],
        })
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deliveriesKey })
      void queryClient.invalidateQueries({ queryKey: ordersKey })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
    },
  })
}

export function useUploadLivraisonMedia() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ delivery, file }: { delivery: Delivery; file: File }) => {
      if (!file.type.startsWith('image/')) throw new Error('Choisissez une image JPEG, PNG ou WebP.')
      if (delivery.status !== 'delivered') throw new Error('Impossible d’ajouter un fichier à un bon annulé.')
      const mediaId = crypto.randomUUID()
      const dataUrl = await compressProfilePhoto(file)
      const media = { id: mediaId, name: file.name, contentType: 'image/jpeg' as const, dataUrl }
      const mediaBytes = new Blob([dataUrl]).size
      await runTransaction(db, async (transaction) => {
        const reference = doc(db, 'bonsLivraison', delivery.id)
        const snapshot = await transaction.get(reference)
        if (!snapshot.exists()) throw new Error('Bon de livraison introuvable.')
        const current = deliverySchema.parse({ ...snapshot.data(), id: snapshot.id })
        if (current.status !== 'delivered') throw new Error('Le bon a été annulé avant la fin de l’ajout.')
        if (current.media.length >= MAX_MEDIA_COUNT) throw new Error('La limite de cinq photos par bon est atteinte.')
        const storedBytes = current.media.reduce((total, item) => total + new Blob([item.dataUrl]).size, 0)
        if (storedBytes + mediaBytes > MAX_MEDIA_TOTAL_BYTES) {
          throw new Error('La taille totale des photos dépasse la limite autorisée.')
        }
        transaction.update(reference, {
          media: [...current.media, media],
          updatedAt: new Date().toISOString(),
          updatedBy: uid,
          history: [...current.history, newHistoryEntry('Photo ajoutée', uid, file.name)],
        })
      })
      return media
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deliveriesKey }),
  })
}

export type OrderForDelivery = Pick<Order, 'id' | 'number' | 'lines' | 'status'>
