import { z } from 'zod'

export const articleUnits = ['piece', 'heure', 'jour', 'forfait', 'metre', 'kilogramme', 'litre'] as const

export const articleSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  reference: z.string().trim(),
  designation: z.string().trim().min(2, 'La désignation doit contenir au moins 2 caractères.'),
  categorie: z.string().trim(),
  description: z.string(),
  unite: z.enum(articleUnits),
  prixAchatCents: z.number().int().min(0, 'Le prix d’achat ne peut pas être négatif.'),
  prixVenteCents: z.number().int().min(0, 'Le prix de vente ne peut pas être négatif.'),
  tauxTva: z.number().min(0).max(100),
  suiviStock: z.boolean(),
  seuilAlerte: z.number().min(0).optional(),
  seuilMax: z.number().min(0).optional(),
  emplacementHabituel: z.string().optional(),
  fournisseurPrincipalId: z.string().optional(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export type Article = z.infer<typeof articleSchema>
export type ArticleInput = Omit<Article, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export const articleUnitLabels: Record<Article['unite'], string> = {
  piece: 'Pièce',
  heure: 'Heure',
  jour: 'Jour',
  forfait: 'Forfait',
  metre: 'Mètre',
  kilogramme: 'Kilogramme',
  litre: 'Litre',
}

export const emptyArticleInput: ArticleInput = {
  reference: '',
  designation: '',
  categorie: '',
  description: '',
  unite: 'piece',
  prixAchatCents: 0,
  prixVenteCents: 0,
  tauxTva: 20,
  suiviStock: false,
  seuilAlerte: undefined,
  seuilMax: undefined,
  emplacementHabituel: '',
  fournisseurPrincipalId: '',
  archive: false,
}

export function formatCents(amountCents: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
  }).format(amountCents / 100)
}
