import { describe, expect, it } from 'vitest'
import {
  applyFulfillmentIncrements,
  calculateCommercialTotals,
  fulfillmentStatus,
  lineRemainingQuantity,
  restoreFulfillmentIncrements,
} from '../src/features/commercial/calculations'
import { assertQuoteCanBeConverted, createClientOrderFromQuote } from '../src/features/commercial/orderConversion'
import { calculateTotals } from '../src/lib/format'
import type { DocumentLine } from '../src/features/documents/types'
import type { Quote } from '../src/features/devis/types'

describe('calculs commerciaux', () => {
  it('calcule les totaux commerciaux en centimes', () => {
    const totals = calculateCommercialTotals([{
      id: 'line-1',
      designation: 'Pièce',
      reference: '',
      description: '',
      quantity: 1.5,
      unit: 'pièce',
      unitPriceCents: 10,
      discountPercent: 10,
      vatPercent: 20,
    }])

    expect(totals).toEqual({
      subtotalCents: 15,
      discountCents: 2,
      totalHTCents: 13,
      vatByRate: [{ rate: 20, amountCents: 3 }],
      totalVATCents: 3,
      totalTTCCents: 16,
    })
  })

  it('applique les remises par ligne et globale avec plusieurs taux de TVA en centimes', () => {
    const lines: DocumentLine[] = [
      { id: '20', designation: 'Article TVA 20 %', description: '', quantity: 1, unit: 'u', unitPriceHT: 100, discountPercent: 10, vatPercent: 20 },
      { id: '10', designation: 'Article TVA 10 %', description: '', quantity: 1, unit: 'u', unitPriceHT: 50, discountPercent: 20, vatPercent: 10 },
      { id: '0', designation: 'Article exonéré', description: '', quantity: 1, unit: 'u', unitPriceHT: 10, discountPercent: 0, vatPercent: 0 },
    ]

    expect(calculateTotals(lines, 10)).toEqual({
      subtotalHT: 160,
      discounts: 34,
      totalHT: 126,
      vatByRate: [
        { rate: 0, amount: 0 },
        { rate: 10, amount: 3.6 },
        { rate: 20, amount: 16.2 },
      ],
      totalVAT: 19.8,
      totalTTC: 145.8,
    })
  })
})

describe('traitement des quantités de commande', () => {
  it('calcule correctement le reste après plusieurs livraisons partielles et refuse un dépassement', () => {
    const orderLines = [{ id: 'line-1', orderedQuantity: 10, fulfilledQuantity: 2 }]
    const afterFirstDelivery = applyFulfillmentIncrements(orderLines, [{ orderLineId: 'line-1', quantity: 3 }])
    const afterSecondDelivery = applyFulfillmentIncrements(afterFirstDelivery, [{ orderLineId: 'line-1', quantity: 2.5 }])

    expect(lineRemainingQuantity(10, afterSecondDelivery[0].fulfilledQuantity)).toBe(2.5)
    expect(fulfillmentStatus(afterSecondDelivery)).toBe('partially_received')
    expect(() => applyFulfillmentIncrements(afterSecondDelivery, [{ orderLineId: 'line-1', quantity: 2.51 }]))
      .toThrow('La quantité demandée dépasse le reste à traiter.')
  })

  it('refuse les lignes de livraison dupliquées et restitue les quantités à l’annulation', () => {
    const orderLines = [{ id: 'line-1', orderedQuantity: 10, fulfilledQuantity: 7 }]
    expect(() => applyFulfillmentIncrements(orderLines, [
      { orderLineId: 'line-1', quantity: 1 },
      { orderLineId: 'line-1', quantity: 1 },
    ])).toThrow('Une ligne de commande ne peut apparaître qu’une fois.')

    const restored = restoreFulfillmentIncrements(orderLines, [{ orderLineId: 'line-1', quantity: 4 }])
    expect(restored[0].fulfilledQuantity).toBe(3)
    expect(fulfillmentStatus(restored)).toBe('partially_received')

    const fullyRestored = restoreFulfillmentIncrements(restored, [{ orderLineId: 'line-1', quantity: 3 }])
    expect(fullyRestored[0].fulfilledQuantity).toBe(0)
    expect(fulfillmentStatus(fullyRestored)).toBe('ordered')
    expect(() => restoreFulfillmentIncrements([{ id: 'other', orderedQuantity: 1, fulfilledQuantity: 0 }], [
      { orderLineId: 'missing', quantity: 1 },
    ])).toThrow('Une ligne à restaurer n’appartient pas à cette commande.')
  })
})

describe('conversion d’un devis', () => {
  const quote: Quote = {
    id: 'quote-1',
    number: 'DEV-2026-0001',
    client: { id: 'client-1', name: 'Client TGI', address: '', city: '', ice: '', phone: '', email: '' },
    lines: [{
      id: 'line-1',
      designation: 'Pièce',
      reference: 'REF-1',
      description: '',
      quantity: 2,
      unit: 'pièce',
      unitPriceCents: 1000,
      discountPercent: 0,
      vatPercent: 20,
    }],
    totals: {
      subtotalCents: 2000,
      discountCents: 0,
      totalHTCents: 2000,
      vatByRate: [{ rate: 20, amountCents: 400 }],
      totalVATCents: 400,
      totalTTCCents: 2400,
    },
    status: 'accepted',
    issueDate: '2026-02-01',
    validUntil: '2026-03-01',
    notes: 'Notes',
    conditions: '',
    revision: 1,
    revisions: [],
    history: [],
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  }

  it('refuse de convertir un devis déjà converti', () => {
    expect(() => assertQuoteCanBeConverted({ status: 'converted' }))
      .toThrow('Ce devis a déjà été converti en commande.')
  })

  it('convertit un devis accepté en commande avec des quantités non traitées', () => {
    expect(() => assertQuoteCanBeConverted(quote)).not.toThrow()
    const order = createClientOrderFromQuote(
      quote,
      'order-1',
      'BCC-2026-0001',
      '2026-02-01T10:00:00.000Z',
      'user-1',
    )

    expect(order.sourceQuoteId).toBe(quote.id)
    expect(order.sourceQuoteNumber).toBe(quote.number)
    expect(order.status).toBe('ordered')
    expect(order.lines[0].orderedQuantity).toBe(2)
    expect(order.lines[0].fulfilledQuantity).toBe(0)
    expect(order.totals.totalTTCCents).toBe(2400)
  })
})
