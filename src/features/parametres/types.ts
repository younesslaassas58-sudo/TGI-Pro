export type DocumentNumberType =
  | 'devis'
  | 'commande'
  | 'livraison'
  | 'facture'
  | 'recu'
  | 'intervention'
  | 'client'
  | 'ascenseur'
  | 'article'
  | 'fournisseur'
  | 'bon_commande_client'
  | 'bon_commande_fournisseur'
  | 'bon_livraison'
  | 'fiche_client'
  | 'fiche_ascenseur'
  | 'technicien'
  | 'fiche_technicien'
  | 'contrat'
  | 'releve'
  | 'relance'
  | 'mouvement_stock'
  | 'inventaire'
  | 'bon_entree'
  | 'bon_sortie'
  | 'bon_transfert'
  | 'bon_intervention'
  | 'rapport_intervention'

export type DocumentFont = 'Helvetica' | 'Times-Roman' | 'Courier'
export type HeaderLogoPosition = 'gauche' | 'droite'
export type CompanyImageKind = 'logo' | 'stamp' | 'signature'

export interface BankAccount {
  id: string
  bank: string
  holder: string
  rib: string
  iban: string
  swift: string
  isDefault: boolean
}

export interface DocumentNumberSetting {
  prefix: string
  format: string
  counterLength: number
  year: number
}

export interface CompanySettings {
  legalName: string
  tradeName: string
  slogan: string
  legalForm: string
  capital: string
  address: string
  city: string
  postalCode: string
  country: string
  phones: string[]
  email: string
  website: string
  ice: string
  rc: string
  tribunal: string
  taxId: string
  patente: string
  cnss: string
  defaultVat: number
  legalMentions: string
  bankAccounts: BankAccount[]
  images: Partial<Record<CompanyImageKind, string>>
  documentAppearance: {
    primaryColor: string
    accentColor: string
    font: DocumentFont
    headerLogoPosition: HeaderLogoPosition
    showSlogan: boolean
    showStamp: boolean
    showSignature: boolean
    showBankDetails: boolean
    showLegalMentions: boolean
  }
  autoriserStockNegatif: boolean
  numbering: Record<DocumentNumberType, DocumentNumberSetting>
}
