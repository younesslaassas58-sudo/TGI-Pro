import { z } from 'zod'

export const depotTypes = ['principal', 'vehicule', 'chantier', 'autre'] as const
export const mouvementTypes = [
  'entree_achat', 'entree_retour', 'entree_manuelle', 'sortie_livraison',
  'sortie_intervention', 'sortie_manuelle', 'transfert', 'ajustement_inventaire', 'casse_perte',
] as const
export const stockStatuses = ['ok', 'bas', 'rupture', 'surstock'] as const

const auditFields = {
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
}

export const depotSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  nom: z.string().min(1),
  type: z.enum(depotTypes),
  technicienId: z.string().optional(),
  technicienUid: z.string().optional(),
  adresse: z.string().default(''),
  actif: z.boolean(),
  archive: z.boolean(),
  ...auditFields,
})
export type Depot = z.infer<typeof depotSchema>

export const stockNiveauSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  depotId: z.string(),
  quantite: z.number(),
  codeSnapshot: z.string(),
  designationSnapshot: z.string(),
  unite: z.string(),
  updatedAt: z.string(),
})
export type StockNiveau = z.infer<typeof stockNiveauSchema>

export const stockCoutSchema = z.object({
  articleId: z.string(),
  pmpHT: z.number().int().min(0),
  dernierPrixAchatHT: z.number().int().min(0),
  quantiteTotale: z.number().min(0),
  updatedAt: z.string(),
})
export type StockCout = z.infer<typeof stockCoutSchema>

export const mouvementSchema = z.object({
  id: z.string(),
  numero: z.string(),
  date: z.string(),
  type: z.enum(mouvementTypes),
  direction: z.enum(['entree', 'sortie']).optional(),
  articleId: z.string(),
  codeSnapshot: z.string(),
  designationSnapshot: z.string(),
  unite: z.string(),
  depotSourceId: z.string().optional(),
  depotDestinationId: z.string().optional(),
  quantite: z.number().positive(),
  coutUnitaireHT: z.number().int().min(0).optional(),
  pmpAvant: z.number().int().min(0).optional(),
  pmpApres: z.number().int().min(0),
  soldeSourceApres: z.number().optional(),
  soldeDestinationApres: z.number().optional(),
  reference: z.object({ type: z.string(), id: z.string(), interventionId: z.string().optional() }).optional(),
  motif: z.string(),
  uid: z.string(),
  auteurNom: z.string(),
  annule: z.boolean(),
  mouvementInverseId: z.string().optional(),
  createdAt: z.string(),
})
export type Mouvement = z.infer<typeof mouvementSchema>

export const inventaireLigneSchema = z.object({
  articleId: z.string(),
  codeSnapshot: z.string(),
  designationSnapshot: z.string(),
  unite: z.string(),
  quantiteTheorique: z.number(),
  quantiteComptee: z.number().optional(),
  ecart: z.number().optional(),
  coutUnitaire: z.number().int().min(0),
  valeurEcart: z.number().int().optional(),
  commentaire: z.string(),
})
export const inventaireSchema = z.object({
  id: z.string(),
  numero: z.string(),
  depotId: z.string(),
  date: z.string(),
  statut: z.enum(['en_cours', 'valide', 'annule']),
  lignes: z.array(inventaireLigneSchema),
  totalEcartValeur: z.number().int(),
  validePar: z.string().optional(),
  valideLe: z.string().optional(),
  notes: z.string(),
  ...auditFields,
})
export type Inventaire = z.infer<typeof inventaireSchema>
export type InventaireLigne = z.infer<typeof inventaireLigneSchema>

export interface MouvementInput {
  type: Mouvement['type']
  articleId: string
  depotSourceId?: string
  depotDestinationId?: string
  quantite: number
  coutUnitaireHT?: number
  reference?: Mouvement['reference']
  motif: string
}
