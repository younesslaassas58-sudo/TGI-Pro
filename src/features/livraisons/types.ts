import { z } from 'zod'
import { auditFieldsSchema, historyEntrySchema, partySnapshotSchema } from '@/features/commercial/types'

export const deliveryStatusValues = ['draft', 'delivered', 'cancelled'] as const
export type DeliveryStatus = typeof deliveryStatusValues[number]

export const deliveryLineSchema = z.object({
  id: z.string().min(1),
  orderLineId: z.string().min(1),
  designation: z.string().min(1),
  unit: z.string(),
  quantity: z.number().positive(),
})

export const mediaSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  contentType: z.literal('image/jpeg'),
  dataUrl: z.string().startsWith('data:image/jpeg;base64,'),
})

export const deliverySchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  orderId: z.string().min(1),
  orderNumber: z.string().min(1),
  depotId: z.string().default(''),
  client: partySnapshotSchema,
  lines: z.array(deliveryLineSchema),
  status: z.enum(deliveryStatusValues),
  deliveredAt: z.string().datetime().optional(),
  signedBy: z.string().default(''),
  signatureDataUrl: z.string().optional(),
  media: z.array(mediaSchema),
  notes: z.string().default(''),
  history: z.array(historyEntrySchema),
  ...auditFieldsSchema.shape,
})

export type Delivery = z.infer<typeof deliverySchema>
export type DeliveryInput = Pick<Delivery, 'orderId' | 'depotId' | 'lines' | 'signedBy' | 'signatureDataUrl' | 'notes'>
