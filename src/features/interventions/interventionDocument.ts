import { calculateTotals } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { Client } from '@/features/clients/types'
import type { Intervention, InterventionMedia } from './types'
import { interventionStatusLabels, interventionTypeLabels, priorityLabels } from './types'
import { baseModel } from '@/features/documents/fichaModel'
import type { DocumentModel, DocumentSection } from '@/features/documents/types'

function fields(id: string, title: string, values: Array<[string, string | number]>): DocumentSection {
  return {
    id,
    title,
    kind: 'fields',
    content: '',
    fields: values.map(([label, value], index) => ({
      id: `${id}-${index}`,
      label,
      value: value === '' ? '—' : String(value),
    })),
  }
}

export function createInterventionDocument(
  intervention: Intervention,
  client: Client | undefined,
  issuer: CompanySettings,
  number: string,
  kind: 'bon_intervention' | 'rapport_intervention',
  medias: InterventionMedia[] = [],
  technicianLabels: string[] = [],
): DocumentModel {
  const sections: DocumentSection[] = [
    fields('client-appareil', 'Client et appareil', [
      ['N° intervention', intervention.numero],
      ['Client', intervention.clientNomSnapshot],
      ['Appareil', intervention.ascenseurCodeSnapshot],
      ['Site', intervention.adresseSiteSnapshot],
      ['Demandeur', intervention.demandeur.nom],
      ['Téléphone', intervention.demandeur.telephone],
      ['Type', interventionTypeLabels[intervention.type]],
      ['Priorité', priorityLabels[intervention.priorite]],
      ['Statut', interventionStatusLabels[intervention.statut]],
      ['Date prévue', intervention.datePrevue.slice(0, 10)],
      ['Heure prévue', intervention.heurePrevue],
      ['Équipe affectée', technicianLabels.length ? technicianLabels.join(', ') : intervention.technicienPrincipalId],
    ]),
    { id: 'demande', title: 'Demande', kind: 'text', content: intervention.descriptionDemande },
  ]

  if (kind === 'rapport_intervention') {
    sections.push(
      fields('rapport', 'Compte rendu technique', [
        ['Début réel', intervention.dateDebutReelle ?? ''],
        ['Fin réelle', intervention.dateFinReelle ?? ''],
        ['Durée', intervention.dureeMinutes === undefined ? '' : `${intervention.dureeMinutes} minutes`],
        ['Temps de déplacement', `${intervention.tempsDeplacementMinutes} minutes`],
        ['État après intervention', intervention.etatApresIntervention.replaceAll('_', ' ')],
        ['Personne bloquée', intervention.personneBloquee ? 'Oui' : 'Non'],
        ['Couvert par contrat', intervention.couvertParContrat ? 'Oui' : 'Non'],
      ]),
      { id: 'diagnostic', title: 'Diagnostic', kind: 'text', content: intervention.diagnostic },
      { id: 'travaux', title: 'Travaux réalisés', kind: 'text', content: intervention.travauxRealises },
      {
        id: 'checklist',
        title: 'Checklist de sécurité',
        kind: 'checklist',
        content: '',
        checks: intervention.checklist.map((item, index) => ({
          id: `check-${index}`,
          label: `${item.point} — ${item.resultat.replaceAll('_', ' ')}${item.commentaire ? ` : ${item.commentaire}` : ''}`,
          checked: item.resultat === 'ok',
        })),
      },
      {
        id: 'parts',
        title: 'Pièces utilisées',
        kind: 'table',
        content: '',
        table: {
          columns: ['Désignation', 'Quantité', 'Unité'],
          rows: intervention.piecesUtilisees.map((part) => [part.designation, String(part.quantite), part.unite]),
        },
      },
      { id: 'observations', title: 'Observations', kind: 'text', content: intervention.observations },
      { id: 'recommendations', title: 'Recommandations', kind: 'text', content: intervention.recommandations },
      { id: 'signataire', title: 'Signature', kind: 'text', content: `Nom du signataire : ${intervention.nomSignataire || '—'}` },
    )
    medias.filter((media) => media.type !== 'signature').forEach((media, index) => {
      sections.push({
        id: `photo-${index + 1}`,
        title: media.type === 'photo_avant' ? 'Photo avant intervention' : 'Photo après intervention',
        kind: 'text',
        content: '',
        imageData: media.dataUrl,
      })
    })
    const signature = medias.find((media) => media.type === 'signature')
    if (signature) sections.push({
      id: 'signature-client',
      title: 'Signature du client',
      kind: 'text',
      content: '',
      imageData: signature.dataUrl,
    })
  }

  const addressParts = intervention.adresseSiteSnapshot.split(',').map((part) => part.trim())
  const model = baseModel(
    issuer,
    kind === 'bon_intervention'
      ? `Bon d’intervention — ${intervention.numero}`
      : `Rapport d’intervention — ${intervention.numero}`,
    number,
    {
      name: client?.raisonSociale ?? intervention.clientNomSnapshot,
      address: client?.adresse ?? addressParts[0] ?? '',
      city: client?.ville ?? addressParts.at(-1) ?? '',
      ice: client?.ice ?? '',
      phone: client?.telephones.find(Boolean) ?? intervention.demandeur.telephone,
      email: client?.email ?? '',
    },
    kind,
    sections,
  )
  model.type = 'fiche'
  model.totals = calculateTotals([])
  return model
}
