import { z } from 'zod'
import { auditFieldsSchema, commercialLineSchema, commercialTotalsSchema, historyEntrySchema, partySnapshotSchema, type CommercialLine } from '@/features/commercial/types'

export const orderKindValues = ['client', 'fournisseur'] as const
export type OrderKind = typeof orderKindValues[number]
export const orderStatusValues = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'] as const
export type OrderStatus = typeof orderStatusValues[number]

export const orderLineSchema = commercialLineSchema.extend({
  orderedQuantity: z.number().positive(),
  fulfilledQuantity: z.number().min(0).default(0),
})

export const orderSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  kind: z.enum(orderKindValues),
  party: partySnapshotSchema,
  lines: z.array(orderLineSchema),
  totals: commercialTotalsSchema,
  status: z.enum(orderStatusValues),
  orderDate: z.string(),
  expectedDate: z.string().default(''),
  sourceQuoteId: z.string().optional(),
  sourceQuoteNumber: z.string().optional(),
  history: z.array(historyEntrySchema),
  notes: z.string().default(''),
  ...auditFieldsSchema.shape,
})

export type Order = z.infer<typeof orderSchema>
export type OrderInput = {
  kind: OrderKind
  party: Order['party']
  lines: CommercialLine[]
  orderDate: string
  expectedDate: string
  notes: string
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  draft: 'Brouillon',
  ordered: 'Commandée',
  partially_received: 'Partiellement reçue',
  received: 'Réceptionnée',
  cancelled: 'Annulée',
}
