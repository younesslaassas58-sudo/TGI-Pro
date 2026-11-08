import { z } from 'zod'

export const clientSnapshotSchema = z.object({
  nom: z.string().min(1),
  adresse: z.string().default(''),
  ville: z.string().default(''),
  ice: z.string().default(''),
  telephone: z.string().default(''),
  email: z.string().default(''),
})

export const contractSchema = z.object({
  id: z.string().min(1),
  numero: z.string().min(1),
  clientId: z.string().min(1),
  client: clientSnapshotSchema,
  ascenseursIds: z.array(z.string()),
  ascenseursCodes: z.array(z.string()),
  typePrestation: z.enum(['entretien', 'maintenance_complete', 'autre']),
  periodicite: z.enum(['mensuel', 'trimestriel', 'semestriel', 'annuel']),
  montantPeriodeHT: z.number().int().min(0),
  tvaPct: z.number().min(0).max(100),
  montantPeriodeTTC: z.number().int().min(0),
  dateDebut: z.string(),
  dateFin: z.string(),
  jourEcheance: z.union([z.number().int().min(1).max(28), z.literal('fin_de_mois')]),
  modePaiementHabituel: z.string(),
  reconductionTacite: z.boolean(),
  indexationPct: z.number().min(0).max(100).optional(),
  statut: z.enum(['actif', 'suspendu', 'resilie', 'termine']),
  dateResiliation: z.string().optional(),
  motifResiliation: z.string().optional(),
  notes: z.string(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})
export type RecouvrementContrat = z.infer<typeof contractSchema>
export type ContratInput = Omit<RecouvrementContrat, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'montantPeriodeTTC'>

export const echeanceStatusValues = ['ouverte', 'soldee', 'annulee'] as const
export const echeanceSchema = z.object({
  id: z.string().min(1),
  contratId: z.string().optional(),
  clientId: z.string().min(1),
  clientNomSnapshot: z.string(),
  libelle: z.string().min(1),
  periodeDebut: z.string(),
  periodeFin: z.string(),
  dateEcheance: z.string(),
  montantHT: z.number().int().min(0),
  tvaPct: z.number().min(0).max(100),
  montantTTC: z.number().int().min(0),
  montantPaye: z.number().int().min(0),
  statut: z.enum(echeanceStatusValues),
  devisId: z.string().optional(),
  bonCommandeId: z.string().optional(),
  notes: z.string().default(''),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})
export type Echeance = z.infer<typeof echeanceSchema>
export type EcheanceInput = Pick<Echeance, 'clientId' | 'clientNomSnapshot' | 'libelle' | 'periodeDebut' | 'periodeFin' | 'dateEcheance' | 'montantHT' | 'tvaPct' | 'montantTTC' | 'notes' | 'devisId' | 'bonCommandeId'>

export const paymentModeValues = ['especes', 'cheque', 'virement', 'carte', 'effet'] as const
export const paymentAllocationSchema = z.object({
  echeanceId: z.string(),
  libelle: z.string(),
  montant: z.number().int().positive(),
})
export const paiementSchema = z.object({
  id: z.string().min(1),
  numero: z.string().min(1),
  date: z.string(),
  clientId: z.string().min(1),
  client: clientSnapshotSchema,
  montant: z.number().int().positive(),
  mode: z.enum(paymentModeValues),
  reference: z.string(),
  banque: z.string(),
  dateEncaissementCheque: z.string().optional(),
  affectations: z.array(paymentAllocationSchema),
  note: z.string(),
  annule: z.boolean(),
  motifAnnulation: z.string().optional(),
  annulePar: z.string().optional(),
  annuleLe: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})
export type Paiement = z.infer<typeof paiementSchema>
export type PaymentInput = Pick<Paiement, 'date' | 'clientId' | 'client' | 'montant' | 'mode' | 'reference' | 'banque' | 'dateEncaissementCheque' | 'affectations' | 'note'>

export const relanceSchema = z.object({
  id: z.string().min(1),
  clientId: z.string(),
  client: clientSnapshotSchema,
  echeancesIds: z.array(z.string()),
  niveau: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  canal: z.enum(['telephone', 'whatsapp', 'email', 'courrier', 'visite']),
  date: z.string(),
  note: z.string(),
  promesseDate: z.string().optional(),
  promesseMontant: z.number().int().min(0).optional(),
  resultat: z.enum(['sans_reponse', 'promesse', 'refus', 'paye']),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})
export type Relance = z.infer<typeof relanceSchema>
