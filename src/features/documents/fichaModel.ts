import { calculateTotals } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { Client } from '@/features/clients/types'
import type { Ascenseur } from '@/features/parc/types'
import { clientTypeLabels } from '@/features/clients/types'
import { contractLabels, deviceTypeLabels } from '@/features/parc/types'
import type { Technician, TechnicianPrivate } from '@/features/techniciens/types'
import { specialtyLabels } from '@/features/techniciens/types'
import type { DocumentModel, DocumentSection, FichaField } from './types'

function fields(id: string, values: Array<[string, string | number]>): DocumentSection {
  const content: FichaField[] = values.map(([label, value], index) => ({
    id: `${id}-${index}`,
    label,
    value: value === '' ? '—' : String(value),
  }))
  return { id, title: id, kind: 'fields', content: '', fields: content }
}

export function baseModel(
  issuer: CompanySettings,
  title: string,
  number: string,
  recipient: DocumentModel['recipient'],
  numberingType: NonNullable<DocumentModel['numberingType']>,
  sections: DocumentSection[],
): DocumentModel {
  return {
    type: 'fiche',
    numberingType,
    number,
    date: new Date().toISOString().slice(0, 10),
    title,
    issuer,
    recipient,
    references: '',
    lines: [],
    totals: calculateTotals([]),
    notes: '',
    conditions: '',
    paymentMethod: '',
    deliveryTime: '',
    sections,
    options: {
      showLogo: true,
      showStamp: issuer.documentAppearance.showStamp,
      showSignature: issuer.documentAppearance.showSignature,
      showBankDetails: issuer.documentAppearance.showBankDetails,
      showAmountInWords: false,
      showWatermark: false,
      showLegalMentions: issuer.documentAppearance.showLegalMentions,
      showSlogan: issuer.documentAppearance.showSlogan,
      accentColor: issuer.documentAppearance.accentColor,
      orientation: 'portrait',
    },
  }
}

export function createClientFicha(
  client: Client,
  elevators: Ascenseur[],
  issuer: CompanySettings,
  number: string,
): DocumentModel {
  const clientFields = fields('Identité et coordonnées', [
    ['Code client', client.code],
    ['Type de client', clientTypeLabels[client.typeClient]],
    ['Raison sociale / nom', client.raisonSociale],
    ['ICE', client.ice],
    ['RC', client.rc],
    ['Identifiant fiscal', client.identifiantFiscal],
    ['Adresse', client.adresse],
    ['Ville', client.ville],
    ['Quartier', client.quartier],
    ['Code postal', client.codePostal],
    ['Téléphones', client.telephones.filter(Boolean).join(' · ')],
    ['E-mail', client.email],
    ['Site web', client.siteWeb],
    ['Statut', client.statut],
  ])
  clientFields.title = 'Identité et coordonnées'
  const paymentFields = fields('Facturation et paiement', [
    ['Mode de paiement habituel', client.modePaiementHabituel],
    ['Délai de paiement', `${client.delaiPaiementJours} jours`],
    ['Commercial responsable', client.commercialResponsableUid],
  ])
  paymentFields.title = 'Facturation et paiement'
  const sections: DocumentSection[] = [clientFields]
  if (client.contacts.length) {
    sections.push({
      id: 'contacts',
      title: 'Contacts',
      kind: 'table',
      content: '',
      table: {
        columns: ['Nom', 'Fonction', 'Téléphone', 'E-mail'],
        rows: client.contacts.map((contact) => [contact.nom, contact.fonction, contact.telephone, contact.email]),
      },
    })
  }
  sections.push(paymentFields)
  sections.push({
    id: 'appareils',
    title: 'Appareils du client',
    kind: 'table',
    content: '',
    table: {
      columns: ['Code', 'Type', 'Marque', 'Adresse', 'État', 'Contrat'],
      rows: elevators.map((item) => [item.code, deviceTypeLabels[item.typeAppareil], item.marque, item.adresseSite, item.etatAppareil.replaceAll('_', ' '), contractLabels[item.contrat]]),
    },
  })
  sections.push({ id: 'notes', title: 'Notes', kind: 'text', content: client.notes })

  return baseModel(
    issuer,
    `Fiche client — ${client.raisonSociale}`,
    number,
    {
      name: client.raisonSociale,
      address: client.adresse,
      city: client.ville,
      ice: client.ice,
      phone: client.telephones.find(Boolean) ?? '',
      email: client.email,
    },
    'fiche_client',
    sections,
  )
}

export function createAscenseurFicha(
  item: Ascenseur,
  client: Client | undefined,
  issuer: CompanySettings,
  number: string,
): DocumentModel {
  const clientSite = fields('Client et site', [
    ['Client', item.clientNomSnapshot],
    ['Code client', client?.code ?? ''],
    ['Adresse du site', item.adresseSite],
    ['Bâtiment', item.batiment],
    ['Ville', item.villeSite],
  ])
  clientSite.title = 'Client et site'
  const technical = fields('Caractéristiques techniques', [
    ['Code appareil', item.code],
    ['Type', deviceTypeLabels[item.typeAppareil]],
    ['Marque / modèle', `${item.marque} ${item.modele}`],
    ['Numéro de série', item.numeroSerie],
    ['Année d’installation', item.anneeInstallation],
    ['Capacité', `${item.capaciteKg} kg · ${item.capacitePersonnes} personnes`],
    ['Niveaux / arrêts', `${item.nombreNiveaux} / ${item.nombreArrets}`],
    ['Vitesse', item.vitesse],
    ['Commande', item.typeCommande],
    ['Machinerie', item.machinerie.replaceAll('_', ' ')],
    ['État', item.etatAppareil.replaceAll('_', ' ')],
  ])
  technical.title = 'Caractéristiques techniques'
  const contract = fields('Contrat et visites', [
    ['Contrat', contractLabels[item.contrat]],
    ['Période', [item.contratDebut, item.contratFin].filter(Boolean).join(' → ')],
    ['Montant du contrat', `${item.montantContrat.toLocaleString('fr-FR')} MAD`],
    ['Périodicité des visites', `${item.periodiciteVisiteJours} jours`],
    ['Dernière visite', item.derniereVisite],
    ['Prochaine visite', item.prochaineVisite],
  ])
  contract.title = 'Contrat et visites'
  return baseModel(
    issuer,
    `Fiche appareil — ${item.code}`,
    number,
    {
      name: item.clientNomSnapshot,
      address: item.adresseSite,
      city: item.villeSite,
      ice: client?.ice ?? '',
      phone: client?.telephones.find(Boolean) ?? '',
      email: client?.email ?? '',
    },
    'fiche_ascenseur',
    [
      clientSite,
      technical,
      contract,
      { id: 'notes', title: 'Notes', kind: 'text', content: item.notes },
      { id: 'observations', title: 'Observations', kind: 'text', content: '' },
    ],
  )
}

export function createTechnicienFicha(
  technician: Technician,
  issuer: CompanySettings,
  number: string,
  privateData?: TechnicianPrivate,
): DocumentModel {
  const professional = fields('Informations professionnelles', [
    ['Matricule', technician.matricule],
    ['Nom', technician.nom],
    ['Prénom', technician.prenom],
    ['Poste', technician.poste],
    ['Téléphone', technician.telephone],
    ['E-mail professionnel', technician.email],
    ['Zone d’intervention', technician.zoneIntervention],
    ['Disponibilité', technician.disponibilite],
    ['Statut', technician.statut === 'conge' ? 'En congé' : technician.statut === 'actif' ? 'Actif' : 'Inactif'],
    ['Véhicule', technician.vehicule],
    ['Spécialités', technician.specialites.map((item) => specialtyLabels[item]).join(', ')],
  ])
  professional.title = 'Informations professionnelles'

  const sections: DocumentSection[] = []
  if (technician.photoURL) sections.push({
    id: 'photo',
    title: 'Photo du technicien',
    kind: 'text',
    content: '',
    imageData: technician.photoURL,
  })
  sections.push(professional, {
    id: 'habilitations',
    title: 'Habilitations et certifications',
    kind: 'table',
    content: '',
    table: {
      columns: ['Intitulé', 'Organisme', 'Obtention', 'Expiration'],
      rows: technician.habilitations.map((item) => [item.intitule, item.organisme, item.dateObtention, item.dateExpiration]),
    },
  })
  if (privateData) {
    const humanResources = fields('Données personnelles RH', [
      ['CIN', privateData.cin],
      ['Date de naissance', privateData.dateNaissance],
      ['Adresse', privateData.adresse],
      ['Date d’embauche', privateData.dateEmbauche],
      ['Type de contrat', privateData.typeContrat],
      ['Personne à prévenir', privateData.personneUrgenceNom],
      ['Téléphone d’urgence', privateData.personneUrgenceTelephone],
    ])
    humanResources.title = 'Données personnelles RH — confidentiel'
    sections.push(humanResources, {
      id: 'notes-rh',
      title: 'Notes RH',
      kind: 'text',
      content: privateData.notesRH,
    })
  }

  const model = baseModel(
    issuer,
    `Fiche technicien — ${technician.prenom} ${technician.nom}`,
    number,
    {
      name: `${technician.prenom} ${technician.nom}`,
      address: '',
      city: technician.zoneIntervention,
      ice: '',
      phone: technician.telephone,
      email: technician.email,
    },
    'fiche_technicien',
    sections,
  )
  model.options.showAmountInWords = false
  return model
}
