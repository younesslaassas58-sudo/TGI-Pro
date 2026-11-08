import type { CompanySettings } from '@/features/parametres/types'

export type DocumentType =
  | 'devis'
  | 'commande'
  | 'livraison'
  | 'facture'
  | 'recu'
  | 'relance'
  | 'intervention'
  | 'client'
  | 'fiche'

export type DocumentOrientation = 'portrait' | 'landscape'
export type FichaNumberingType =
  | 'fiche_client'
  | 'fiche_ascenseur'
  | 'fiche_technicien'
  | 'bon_intervention'
  | 'rapport_intervention'

export interface FichaField {
  id: string
  label: string
  value: string
}

export interface FichaCheck {
  id: string
  label: string
  checked: boolean
}

export interface DocumentLine {
  id: string
  designation: string
  description: string
  quantity: number
  unit: string
  unitPriceHT: number
  discountPercent: number
  vatPercent: number
}

export interface DocumentRecipient {
  name: string
  address: string
  city: string
  ice: string
  phone: string
  email: string
}

export interface DocumentSection {
  id: string
  title: string
  content: string
  kind?: 'text' | 'fields' | 'table' | 'checklist'
  fields?: FichaField[]
  table?: { columns: string[]; rows: string[][] }
  checks?: FichaCheck[]
  imageData?: string
}

export interface DocumentDisplayOptions {
  showLogo: boolean
  showStamp: boolean
  showSignature: boolean
  showBankDetails: boolean
  showAmountInWords: boolean
  showWatermark: boolean
  showLegalMentions: boolean
  showSlogan: boolean
  accentColor: string
  orientation: DocumentOrientation
}

export interface DocumentTotals {
  subtotalHT: number
  discounts: number
  totalHT: number
  vatByRate: Array<{ rate: number; amount: number }>
  totalVAT: number
  totalTTC: number
}

export interface DocumentModel {
  type: DocumentType
  numberingType?: FichaNumberingType
  watermarkText?: string
  number: string
  date: string
  title: string
  issuer: CompanySettings
  recipient: DocumentRecipient
  references: string
  lines: DocumentLine[]
  totals: DocumentTotals
  notes: string
  conditions: string
  paymentMethod: string
  deliveryTime: string
  sections: DocumentSection[]
  options: DocumentDisplayOptions
}
