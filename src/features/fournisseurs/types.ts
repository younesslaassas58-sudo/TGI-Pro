import { z } from 'zod'

export const fournisseurSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  raisonSociale: z.string().trim().min(2, 'Le nom du fournisseur doit contenir au moins 2 caractères.'),
  ice: z.string().trim().regex(/^$|^\d{15}$/, 'L’ICE doit contenir 15 chiffres.'),
  rc: z.string().trim(),
  identifiantFiscal: z.string().trim(),
  adresse: z.string(),
  ville: z.string().trim(),
  codePostal: z.string().trim(),
  telephone: z.string().trim(),
  email: z.string().trim().regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse e-mail invalide.'),
  contactNom: z.string().trim(),
  contactFonction: z.string().trim(),
  contactTelephone: z.string().trim(),
  contactEmail: z.string().trim().regex(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Adresse e-mail invalide.'),
  modePaiement: z.string().trim(),
  delaiPaiementJours: z.number().int().min(0, 'Le délai ne peut pas être négatif.'),
  rib: z.string().trim(),
  notes: z.string(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export type Fournisseur = z.infer<typeof fournisseurSchema>
export type FournisseurInput = Omit<Fournisseur, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export const emptyFournisseurInput: FournisseurInput = {
  raisonSociale: '',
  ice: '',
  rc: '',
  identifiantFiscal: '',
  adresse: '',
  ville: '',
  codePostal: '',
  telephone: '',
  email: '',
  contactNom: '',
  contactFonction: '',
  contactTelephone: '',
  contactEmail: '',
  modePaiement: '',
  delaiPaiementJours: 30,
  rib: '',
  notes: '',
  archive: false,
}
