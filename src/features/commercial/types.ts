import { z } from 'zod'

export const commercialLineSchema = z.object({
  id: z.string().min(1),
  articleId: z.string().optional(),
  reference: z.string().default(''),
  designation: z.string().trim().min(1),
  description: z.string().default(''),
  quantity: z.number().positive(),
  unit: z.string().default('pièce'),
  unitPriceCents: z.number().int().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
  vatPercent: z.number().min(0).max(100),
})

export type CommercialLine = z.infer<typeof commercialLineSchema>

export const partySnapshotSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  address: z.string().default(''),
  city: z.string().default(''),
  ice: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
})

export type PartySnapshot = z.infer<typeof partySnapshotSchema>

export const commercialTotalsSchema = z.object({
  subtotalCents: z.number().int().min(0),
  discountCents: z.number().int().min(0),
  totalHTCents: z.number().int().min(0),
  vatByRate: z.array(z.object({
    rate: z.number().min(0).max(100),
    amountCents: z.number().int().min(0),
  })),
  totalVATCents: z.number().int().min(0),
  totalTTCCents: z.number().int().min(0),
})

export type CommercialTotals = z.infer<typeof commercialTotalsSchema>

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  at: z.string().datetime(),
  by: z.string(),
  details: z.string().default(''),
})

export type HistoryEntry = z.infer<typeof historyEntrySchema>

export const auditFieldsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export function newHistoryEntry(action: string, by: string, details = ''): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    at: new Date().toISOString(),
    by,
    details,
  }
}
