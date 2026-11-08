import { z } from 'zod'

export const interventionTypes = [
  'depannage_urgent', 'entretien', 'reparation', 'installation',
  'modernisation', 'controle', 'mise_en_service',
] as const
export const interventionPriorities = ['urgente', 'haute', 'normale', 'basse'] as const
export const interventionStatuses = [
  'nouvelle', 'planifiee', 'en_cours', 'en_attente_pieces', 'terminee', 'cloturee', 'annulee',
] as const
export const checklistResults = ['ok', 'a_surveiller', 'defaut', 'na'] as const
export const requestChannels = ['telephone', 'whatsapp', 'email', 'contrat', 'sur_place'] as const
export const deviceStates = ['en_service', 'a_l_arret', 'en_panne', 'en_modernisation'] as const

export const checklistItemSchema = z.object({
  point: z.string().min(1),
  resultat: z.enum(checklistResults).default('na'),
  commentaire: z.string().default(''),
})

export const interventionPartSchema = z.object({
  id: z.string().min(1),
  designation: z.string().min(1),
  quantite: z.number().positive(),
  unite: z.string().default('pièce'),
  articleId: z.string().optional(),
  depotId: z.string().optional(),
})

export const statusHistorySchema = z.object({
  statut: z.enum(interventionStatuses),
  date: z.string().datetime(),
  uid: z.string(),
  nom: z.string(),
})

export const interventionSchema = z.object({
  id: z.string().min(1),
  numero: z.string().min(1),
  type: z.enum(interventionTypes),
  priorite: z.enum(interventionPriorities),
  statut: z.enum(interventionStatuses),
  clientId: z.string().min(1),
  clientNomSnapshot: z.string(),
  ascenseurId: z.string().min(1),
  ascenseurCodeSnapshot: z.string(),
  adresseSiteSnapshot: z.string(),
  contratId: z.string().optional(),
  techniciensIds: z.array(z.string()),
  techniciensUids: z.array(z.string()),
  technicienPrincipalId: z.string().default(''),
  canalDemande: z.enum(requestChannels),
  demandeur: z.object({ nom: z.string(), telephone: z.string() }),
  personneBloquee: z.boolean(),
  descriptionDemande: z.string(),
  datePrevue: z.string(),
  heurePrevue: z.string(),
  dateDebutReelle: z.string().optional(),
  dateFinReelle: z.string().optional(),
  dureeMinutes: z.number().int().min(0).optional(),
  tempsDeplacementMinutes: z.number().int().min(0),
  diagnostic: z.string(),
  travauxRealises: z.string(),
  piecesUtilisees: z.array(interventionPartSchema),
  mouvementsStockGeneres: z.boolean(),
  checklist: z.array(checklistItemSchema),
  observations: z.string(),
  recommandations: z.string(),
  etatApresIntervention: z.enum(deviceStates),
  facturable: z.boolean(),
  couvertParContrat: z.boolean(),
  montantEstime: z.number().int().min(0),
  devisId: z.string().optional(),
  nomSignataire: z.string(),
  signatureMediaId: z.string().optional(),
  photosMediaIds: z.array(z.string()),
  annulation: z.string().optional(),
  historiqueStatuts: z.array(statusHistorySchema),
  archive: z.boolean(),
  planificationKey: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export const interventionInputSchema = interventionSchema.omit({
  id: true,
  numero: true,
  statut: true,
  mouvementsStockGeneres: true,
  historiqueStatuts: true,
  archive: true,
  planificationKey: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  dureeMinutes: true,
  dateDebutReelle: true,
  dateFinReelle: true,
})

export const interventionMediaSchema = z.object({
  id: z.string().min(1),
  dataUrl: z.string().startsWith('data:image/jpeg;base64,'),
  type: z.enum(['photo_avant', 'photo_apres', 'signature']),
  createdAt: z.string().datetime(),
  createdBy: z.string(),
})

export type Intervention = z.infer<typeof interventionSchema>
export type InterventionInput = Omit<Intervention,
  'id' | 'numero' | 'statut' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' |
  'dureeMinutes' | 'mouvementsStockGeneres' | 'historiqueStatuts' | 'archive' | 'planificationKey'>
export type InterventionMedia = z.infer<typeof interventionMediaSchema>
export type InterventionStatus = Intervention['statut']

export const interventionTypeLabels: Record<Intervention['type'], string> = {
  depannage_urgent: 'Dépannage urgent',
  entretien: 'Entretien préventif',
  reparation: 'Réparation',
  installation: 'Installation',
  modernisation: 'Modernisation',
  controle: 'Contrôle',
  mise_en_service: 'Mise en service',
}

export const interventionStatusLabels: Record<InterventionStatus, string> = {
  nouvelle: 'Nouvelle',
  planifiee: 'Planifiée',
  en_cours: 'En cours',
  en_attente_pieces: 'En attente de pièces',
  terminee: 'Terminée',
  cloturee: 'Clôturée',
  annulee: 'Annulée',
}

export const priorityLabels: Record<Intervention['priorite'], string> = {
  urgente: 'Urgente',
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
}

export function defaultChecklist(type: Intervention['type']): Intervention['checklist'] {
  const points: Record<Intervention['type'], string[]> = {
    depannage_urgent: ['Sécurisation de la zone', 'Diagnostic de la panne', 'Personne bloquée prise en charge', 'Remise en service', 'Test final'],
    entretien: [
      'Portes palières et de cabine', 'Câbles de traction', 'Freins, parachute et limiteur de vitesse',
      'Moteur et machinerie', 'Armoire de commande', 'Cabine et éclairage', 'Boutonnières',
      'Dispositifs de sécurité', 'Cuvette et gaine', 'Éclairage de secours et alarme',
    ],
    reparation: ['Mise en sécurité', 'Équipement réparé', 'Contrôle des dispositifs de sécurité', 'Essai en charge', 'Remise en service et information du client'],
    installation: ['Contrôle de la gaine et de la cuvette', 'Montage mécanique', 'Raccordement électrique', 'Essais des sécurités', 'Essais de fonctionnement', 'Réception du chantier'],
    modernisation: ['État initial relevé', 'Équipements remplacés', 'Conformité des raccordements', 'Essais des sécurités', 'Essais de fonctionnement', 'Information du client'],
    controle: ['Contrôle des accès', 'Contrôle mécanique', 'Contrôle électrique', 'Essais des dispositifs de sécurité', 'Anomalies consignées'],
    mise_en_service: ['Installation vérifiée', 'Paramétrage de commande', 'Essais à vide', 'Essais en charge', 'Formation / consignes client', 'Procès-verbal de mise en service'],
  }
  return points[type].map((point) => ({ point, resultat: 'na', commentaire: '' }))
}
