import type { Quote } from '@/features/devis/types'
import type { Order } from '@/features/commandes/types'
import type { CommercialLine } from './types'

export function assertQuoteCanBeConverted(quote: Pick<Quote, 'status'>): void {
  if (quote.status === 'converted') {
    throw new Error('Ce devis a déjà été converti en commande.')
  }
  if (quote.status !== 'accepted') {
    throw new Error('Seul un devis accepté peut être converti.')
  }
}

export function createClientOrderFromQuote(
  quote: Quote,
  orderId: string,
  number: string,
  now: string,
  uid: string,
): Order {
  const lines: Order['lines'] = quote.lines.map((line: CommercialLine) => ({
    ...line,
    orderedQuantity: line.quantity,
    fulfilledQuantity: 0,
  }))
  return {
    id: orderId,
    number,
    kind: 'client',
    party: quote.client,
    lines,
    totals: quote.totals,
    status: 'ordered',
    orderDate: now.slice(0, 10),
    expectedDate: '',
    sourceQuoteId: quote.id,
    sourceQuoteNumber: quote.number,
    notes: quote.notes,
    history: [{
      id: crypto.randomUUID(),
      action: 'Conversion depuis devis',
      at: now,
      by: uid,
      details: quote.number,
    }],
    createdAt: now,
    updatedAt: now,
    createdBy: uid,
    updatedBy: uid,
  }
}
