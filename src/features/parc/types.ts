import { z } from 'zod'

export const ascenseurSchema = z.object({
  id: z.string(),
  code: z.string(),
  clientId: z.string().min(1, 'Sélectionnez un client.'),
  clientNomSnapshot: z.string(),
  typeAppareil: z.enum(['ascenseur', 'monte_charge', 'monte_plat', 'monte_personne_pmr', 'autre']),
  marque: z.string(),
  modele: z.string(),
  numeroSerie: z.string(),
  anneeInstallation: z.number().int().min(1900).max(2200),
  capaciteKg: z.number().min(0),
  capacitePersonnes: z.number().min(0),
  nombreNiveaux: z.number().int().min(0),
  nombreArrets: z.number().int().min(0),
  vitesse: z.string(),
  typeCommande: z.string(),
  machinerie: z.enum(['avec_local', 'sans_local']),
  adresseSite: z.string(),
  villeSite: z.string(),
  batiment: z.string(),
  etatAppareil: z.enum(['en_service', 'en_panne', 'a_l_arret', 'en_modernisation']),
  contrat: z.enum(['aucun', 'entretien_mensuel', 'entretien_trimestriel', 'entretien_semestriel', 'entretien_annuel']),
  contratDebut: z.string(),
  contratFin: z.string(),
  montantContrat: z.number().min(0),
  periodiciteVisiteJours: z.number().int().min(0),
  derniereVisite: z.string(),
  prochaineVisite: z.string(),
  notes: z.string(),
  archive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
})

export type Ascenseur = z.infer<typeof ascenseurSchema>
export type AscenseurInput = Omit<Ascenseur, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>

export const deviceTypeLabels: Record<Ascenseur['typeAppareil'], string> = {
  ascenseur: 'Ascenseur',
  monte_charge: 'Monte-charge',
  monte_plat: 'Monte-plat',
  monte_personne_pmr: 'Monte-personne PMR',
  autre: 'Autre',
}

export const contractLabels: Record<Ascenseur['contrat'], string> = {
  aucun: 'Aucun',
  entretien_mensuel: 'Entretien mensuel',
  entretien_trimestriel: 'Entretien trimestriel',
  entretien_semestriel: 'Entretien semestriel',
  entretien_annuel: 'Entretien annuel',
}

export const emptyAscenseurInput: AscenseurInput = {
  clientId: '',
  clientNomSnapshot: '',
  typeAppareil: 'ascenseur',
  marque: '',
  modele: '',
  numeroSerie: '',
  anneeInstallation: new Date().getFullYear(),
  capaciteKg: 0,
  capacitePersonnes: 0,
  nombreNiveaux: 0,
  nombreArrets: 0,
  vitesse: '',
  typeCommande: '',
  machinerie: 'avec_local',
  adresseSite: '',
  villeSite: '',
  batiment: '',
  etatAppareil: 'en_service',
  contrat: 'aucun',
  contratDebut: '',
  contratFin: '',
  montantContrat: 0,
  periodiciteVisiteJours: 30,
  derniereVisite: '',
  prochaineVisite: '',
  notes: '',
  archive: false,
}

export function nextVisitDate(lastVisit: string, interval: number): string {
  if (!lastVisit || interval <= 0) return ''
  const date = new Date(`${lastVisit}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() + interval)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
