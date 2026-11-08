import { calculateTotals } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { DocumentLine, DocumentModel, DocumentSection, DocumentType } from '@/features/documents/types'
import type { CommercialLine, PartySnapshot } from './types'

interface DeliveryLine {
  id: string
  designation: string
  description?: string
  quantity: number
  unit: string
}

interface CommercialDocumentInput {
  type: Extract<DocumentType, 'devis' | 'commande' | 'livraison'>
  number: string
  date: string
  title: string
  issuer: CompanySettings
  recipient: PartySnapshot
  lines: Array<CommercialLine | DeliveryLine>
  notes: string
  conditions?: string
  references?: string
  sections?: DocumentSection[]
}

export function toCommercialDocument(input: CommercialDocumentInput): DocumentModel {
  const priceFree = input.type === 'livraison'
  const lines: DocumentLine[] = input.lines.map((line) => ({
    id: line.id,
    designation: line.designation,
    description: line.description ?? '',
    quantity: line.quantity,
    unit: line.unit,
    unitPriceHT: !priceFree && 'unitPriceCents' in line ? line.unitPriceCents / 100 : 0,
    discountPercent: !priceFree && 'discountPercent' in line ? line.discountPercent : 0,
    vatPercent: !priceFree && 'vatPercent' in line ? line.vatPercent : 0,
  }))

  return {
    type: input.type,
    number: input.number,
    date: input.date,
    title: input.title,
    issuer: input.issuer,
    recipient: {
      name: input.recipient.name,
      address: input.recipient.address,
      city: input.recipient.city,
      ice: input.recipient.ice,
      phone: input.recipient.phone,
      email: input.recipient.email,
    },
    references: input.references ?? '',
    lines,
    totals: calculateTotals(lines),
    notes: input.notes,
    conditions: input.conditions ?? '',
    paymentMethod: '',
    deliveryTime: '',
    sections: input.sections ?? [],
    options: {
      showLogo: true,
      showStamp: input.issuer.documentAppearance.showStamp,
      showSignature: input.issuer.documentAppearance.showSignature,
      showBankDetails: input.issuer.documentAppearance.showBankDetails,
      showAmountInWords: !priceFree,
      showWatermark: false,
      showLegalMentions: input.issuer.documentAppearance.showLegalMentions,
      showSlogan: input.issuer.documentAppearance.showSlogan,
      accentColor: input.issuer.documentAppearance.accentColor,
      orientation: 'portrait',
    },
  }
}
