import { z } from 'zod'

export const clientSchema = z.object({
  id: z.string(),
  code: z.string(),
  typeClient: z.enum(['societe', 'particulier', 'syndic', 'administration']),
  raisonSociale: z.string().trim().min(2, 'Le nom du client doit contenir au moins 2 caractères.'),
  ice: z.string().trim().regex(/^$|^\d{15}$/, 'L’ICE doit contenir 15 chiffres.'),
  rc: z.string(),
  identifiantFiscal: z.string(),
  adresse: z.string(),
  ville: z.string(),
  quartier: z.string(),
  codePostal: z.string(),
  telephones: z.array(z.string().trim().refine(
    (value) => !value || /^(?:(?:\+|00)212)?0?[5-7]\d{8}$/.test(value.replace(/[\s.-]/g, '')),
    'Saisissez un numéro marocain valide.',
  )),
  email: z.string().trim().regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse e-mail invalide.'),
  siteWeb: z.string(),
  contacts: z.array(z.object({
    nom: z.string(),
    fonction: z.string(),
    telephone: z.string(),
    email: z.string().trim().regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse e-mail invalide.'),
  })),
  modePaiementHabituel: z.string(),
  delaiPaiementJours: z.number().int().min(0, 'Le délai ne peut pas être négatif.'),
  statut: z.enum(['prospect', 'actif', 'inactif']),
  commercialResponsableUid: z.string(),
  notes: z.string(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export type Client = z.infer<typeof clientSchema>
export type ClientInput = Omit<Client, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export const clientTypeLabels: Record<Client['typeClient'], string> = {
  societe: 'Société',
  particulier: 'Particulier',
  syndic: 'Syndic',
  administration: 'Administration',
}

export const clientStatusLabels: Record<Client['statut'], string> = {
  prospect: 'Prospect',
  actif: 'Actif',
  inactif: 'Inactif',
}

export const emptyClientInput: ClientInput = {
  typeClient: 'societe',
  raisonSociale: '',
  ice: '',
  rc: '',
  identifiantFiscal: '',
  adresse: '',
  ville: '',
  quartier: '',
  codePostal: '',
  telephones: [''],
  email: '',
  siteWeb: '',
  contacts: [],
  modePaiementHabituel: '',
  delaiPaiementJours: 30,
  statut: 'prospect',
  commercialResponsableUid: '',
  notes: '',
  archive: false,
}
