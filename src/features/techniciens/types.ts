import { z } from 'zod'

export const specialties = [
  'installation',
  'maintenance',
  'dépannage',
  'modernisation',
  'électricité',
  'mécanique',
] as const

export const specialtyLabels: Record<(typeof specialties)[number], string> = {
  installation: 'Installation',
  maintenance: 'Maintenance',
  dépannage: 'Dépannage',
  modernisation: 'Modernisation',
  électricité: 'Électricité',
  mécanique: 'Mécanique',
}

export const technicianSchema = z.object({
  id: z.string(),
  matricule: z.string().min(1),
  nom: z.string().trim().min(1, 'Le nom est obligatoire.'),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire.'),
  photoURL: z.string(),
  telephone: z.string().trim().max(30, 'Le numéro de téléphone est trop long.'),
  email: z.union([z.string().email('Saisissez une adresse e-mail valide.'), z.literal('')]),
  poste: z.string(),
  specialites: z.array(z.enum(specialties)).min(1, 'Sélectionnez au moins une spécialité.'),
  zoneIntervention: z.string(),
  statut: z.enum(['actif', 'conge', 'inactif']),
  disponibilite: z.string(),
  habilitations: z.array(z.object({
    intitule: z.string().trim().min(1, 'L’intitulé de l’habilitation est obligatoire.'),
    organisme: z.string(),
    dateObtention: z.string(),
    dateExpiration: z.string(),
  })),
  vehicule: z.string(),
  uidCompte: z.string(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export const technicianPrivateSchema = z.object({
  cin: z.string(),
  dateNaissance: z.string(),
  adresse: z.string(),
  dateEmbauche: z.string(),
  typeContrat: z.string(),
  personneUrgenceNom: z.string(),
  personneUrgenceTelephone: z.string(),
  notesRH: z.string(),
})

export type Technician = z.infer<typeof technicianSchema>
export type TechnicianInput = Omit<Technician, 'id' | 'matricule' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
export type TechnicianPrivate = z.infer<typeof technicianPrivateSchema>

export const emptyTechnicianInput: TechnicianInput = {
  nom: '',
  prenom: '',
  photoURL: '',
  telephone: '',
  email: '',
  poste: '',
  specialites: [],
  zoneIntervention: '',
  statut: 'actif',
  disponibilite: '',
  habilitations: [],
  vehicule: '',
  uidCompte: '',
  archive: false,
}

export const emptyTechnicianPrivate: TechnicianPrivate = {
  cin: '',
  dateNaissance: '',
  adresse: '',
  dateEmbauche: '',
  typeContrat: '',
  personneUrgenceNom: '',
  personneUrgenceTelephone: '',
  notesRH: '',
}

export function technicianSchemaErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Les informations du technicien sont invalides.'
}
