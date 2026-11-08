import type { CommercialLine, CommercialTotals, HistoryEntry } from './types'

function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

export function calculateCommercialTotals(lines: CommercialLine[]): CommercialTotals {
  let subtotalCents = 0
  let discountCents = 0
  const taxable = new Map<number, number>()

  for (const line of lines) {
    const grossCents = roundCents(line.quantity * line.unitPriceCents)
    const discount = Math.min(100, Math.max(0, line.discountPercent))
    const lineDiscountCents = roundCents(grossCents * discount / 100)
    const taxableCents = grossCents - lineDiscountCents
    const rate = Math.min(100, Math.max(0, line.vatPercent))
    subtotalCents += grossCents
    discountCents += lineDiscountCents
    taxable.set(rate, (taxable.get(rate) ?? 0) + taxableCents)
  }

  const vatByRate = [...taxable.entries()]
    .sort(([left], [right]) => left - right)
    .map(([rate, amount]) => ({ rate, amountCents: roundCents(amount * rate / 100) }))
  const totalHTCents = subtotalCents - discountCents
  const totalVATCents = vatByRate.reduce((sum, item) => sum + item.amountCents, 0)
  return {
    subtotalCents,
    discountCents,
    totalHTCents,
    vatByRate,
    totalVATCents,
    totalTTCCents: totalHTCents + totalVATCents,
  }
}

export function lineRemainingQuantity(ordered: number, delivered: number): number {
  return Math.max(0, Math.round((ordered - delivered) * 1_000_000) / 1_000_000)
}

export function canDeliverQuantity(ordered: number, delivered: number, requested: number): boolean {
  return Number.isFinite(requested) && requested > 0 && requested <= lineRemainingQuantity(ordered, delivered)
}

export interface FulfillmentLine {
  id: string
  orderedQuantity: number
  fulfilledQuantity: number
}

export interface FulfillmentIncrement {
  orderLineId: string
  quantity: number
}

export type FulfillmentStatus = 'ordered' | 'partially_received' | 'received'

export function applyFulfillmentIncrements<T extends FulfillmentLine>(
  lines: T[],
  increments: FulfillmentIncrement[],
): T[] {
  const byLine = new Map<string, number>()
  for (const increment of increments) {
    if (byLine.has(increment.orderLineId)) {
      throw new Error('Une ligne de commande ne peut apparaître qu’une fois.')
    }
    const line = lines.find((item) => item.id === increment.orderLineId)
    if (!line || !canDeliverQuantity(line.orderedQuantity, line.fulfilledQuantity, increment.quantity)) {
      throw new Error('La quantité demandée dépasse le reste à traiter.')
    }
    byLine.set(increment.orderLineId, increment.quantity)
  }
  return lines.map((line) => ({
    ...line,
    fulfilledQuantity: line.fulfilledQuantity + (byLine.get(line.id) ?? 0),
  }))
}

export function restoreFulfillmentIncrements<T extends FulfillmentLine>(
  lines: T[],
  increments: FulfillmentIncrement[],
): T[] {
  const byLine = new Map<string, number>()
  const lineIds = new Set(lines.map((line) => line.id))
  for (const increment of increments) {
    if (!lineIds.has(increment.orderLineId)) {
      throw new Error('Une ligne à restaurer n’appartient pas à cette commande.')
    }
    if (!Number.isFinite(increment.quantity) || increment.quantity <= 0) {
      throw new Error('La quantité à restaurer doit être positive.')
    }
    byLine.set(
      increment.orderLineId,
      (byLine.get(increment.orderLineId) ?? 0) + increment.quantity,
    )
  }
  return lines.map((line) => {
    const quantity = byLine.get(line.id) ?? 0
    if (line.fulfilledQuantity < quantity) {
      throw new Error('Le cumul traité est incohérent ; annulation refusée.')
    }
    return { ...line, fulfilledQuantity: line.fulfilledQuantity - quantity }
  })
}

export function fulfillmentStatus(lines: FulfillmentLine[]): FulfillmentStatus {
  if (lines.length > 0 && lines.every((line) => line.fulfilledQuantity >= line.orderedQuantity)) {
    return 'received'
  }
  return lines.some((line) => line.fulfilledQuantity > 0) ? 'partially_received' : 'ordered'
}

export interface QuoteStatistics {
  count: number
  totalCents: number
  byStatus: Record<string, { count: number; totalCents: number }>
  conversionRate: number
}

export function calculateQuoteStatistics(
  quotes: Array<{ status: string; totalTTCCents: number }>,
): QuoteStatistics {
  const byStatus: QuoteStatistics['byStatus'] = {}
  let totalCents = 0
  let converted = 0
  for (const quote of quotes) {
    totalCents += quote.totalTTCCents
    const item = byStatus[quote.status] ?? { count: 0, totalCents: 0 }
    item.count += 1
    item.totalCents += quote.totalTTCCents
    byStatus[quote.status] = item
    if (quote.status === 'accepted' || quote.status === 'converted') converted += 1
  }
  return {
    count: quotes.length,
    totalCents,
    byStatus,
    conversionRate: quotes.length ? converted / quotes.length : 0,
  }
}

export function appendHistory(
  existing: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [...existing, entry]
}
