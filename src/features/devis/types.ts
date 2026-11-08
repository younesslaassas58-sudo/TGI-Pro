import { z } from 'zod'
import { auditFieldsSchema, commercialLineSchema, commercialTotalsSchema, historyEntrySchema, partySnapshotSchema } from '@/features/commercial/types'

export const quoteStatusValues = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const
export type QuoteStatus = typeof quoteStatusValues[number]

export const quoteRevisionSchema = z.object({
  revision: z.number().int().min(1),
  capturedAt: z.string().datetime(),
  client: partySnapshotSchema,
  lines: z.array(commercialLineSchema),
  totals: commercialTotalsSchema,
  issueDate: z.string(),
  validUntil: z.string(),
  notes: z.string().default(''),
  conditions: z.string().default(''),
})

export const quoteSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  client: partySnapshotSchema,
  lines: z.array(commercialLineSchema),
  totals: commercialTotalsSchema,
  status: z.enum(quoteStatusValues),
  issueDate: z.string(),
  validUntil: z.string(),
  notes: z.string().default(''),
  conditions: z.string().default(''),
  revision: z.number().int().min(1),
  revisions: z.array(quoteRevisionSchema).default([]),
  history: z.array(historyEntrySchema),
  shareToken: z.string().optional(),
  sharedAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
  sentRevision: z.number().int().optional(),
  convertedOrderId: z.string().optional(),
  ...auditFieldsSchema.shape,
})

export type Quote = z.infer<typeof quoteSchema>
export type QuoteInput = Pick<Quote, 'client' | 'lines' | 'issueDate' | 'validUntil' | 'notes' | 'conditions'>

export const publicQuoteSchema = z.object({
  quoteId: z.string().min(1),
  shareToken: z.string().min(1),
  number: z.string().min(1),
  status: z.enum(['sent', 'accepted']),
  revision: z.number().int().min(1),
  client: partySnapshotSchema,
  lines: z.array(commercialLineSchema),
  totals: commercialTotalsSchema,
  issueDate: z.string(),
  validUntil: z.string(),
  notes: z.string().default(''),
  conditions: z.string().default(''),
})

export type PublicQuote = z.infer<typeof publicQuoteSchema>

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  rejected: 'Refusé',
  expired: 'Expiré',
  converted: 'Converti en commande',
}
