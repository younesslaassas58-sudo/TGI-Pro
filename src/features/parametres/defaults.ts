import type { CompanySettings, DocumentNumberType } from './types'

const currentYear = new Date().getFullYear()

const numberingDefaults: Record<DocumentNumberType, { prefix: string; format: string }> = {
  devis: { prefix: 'DEV', format: '{PREFIX}-{YYYY}-{NUM}' },
  commande: { prefix: 'BC', format: '{PREFIX}-{YYYY}-{NUM}' },
  livraison: { prefix: 'BL', format: '{PREFIX}-{YYYY}-{NUM}' },
  facture: { prefix: 'FAC', format: '{PREFIX}-{YYYY}-{NUM}' },
  recu: { prefix: 'REC', format: '{PREFIX}-{YYYY}-{NUM}' },
  intervention: { prefix: 'INT', format: '{PREFIX}-{YYYY}-{NUM}' },
  client: { prefix: 'CLI', format: '{PREFIX}-{YYYY}-{NUM}' },
  ascenseur: { prefix: 'ASC', format: '{PREFIX}-{YYYY}-{NUM}' },
  fiche_client: { prefix: 'FCL', format: '{PREFIX}-{YYYY}-{NUM}' },
  fiche_ascenseur: { prefix: 'FAS', format: '{PREFIX}-{YYYY}-{NUM}' },
}

export const defaultCompanySettings: CompanySettings = {
  legalName: 'Technique Général Installation',
  tradeName: 'TGI Ascenseurs',
  slogan: '',
  legalForm: '',
  capital: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Maroc',
  phones: [''],
  email: '',
  website: 'https://tgi-ascenseurs.ma/',
  ice: '',
  rc: '',
  tribunal: '',
  taxId: '',
  patente: '',
  cnss: '',
  defaultVat: 20,
  legalMentions: '',
  bankAccounts: [],
  images: {},
  documentAppearance: {
    primaryColor: '#0B1F3A',
    accentColor: '#C9A227',
    font: 'Helvetica',
    headerLogoPosition: 'gauche',
    showSlogan: true,
    showStamp: true,
    showSignature: true,
    showBankDetails: true,
    showLegalMentions: true,
  },
  numbering: Object.fromEntries(
    Object.entries(numberingDefaults).map(([type, value]) => [
      type,
      { ...value, counterLength: 4, year: currentYear },
    ]),
  ) as CompanySettings['numbering'],
}

export const documentNumberLabels: Record<DocumentNumberType, string> = {
  devis: 'Devis',
  commande: 'Bon de commande',
  livraison: 'Bon de livraison',
  facture: 'Facture',
  recu: 'Reçu',
  intervention: 'Fiche d’intervention',
  client: 'Fiche client',
  ascenseur: 'Fiche appareil',
  fiche_client: 'Fiche client (document)',
  fiche_ascenseur: 'Fiche appareil (document)',
}
