import { describe, expect, it } from 'vitest'
import { defaultCompanySettings } from '../src/features/parametres/defaults'
import {
  createClientRecoveryStatement,
  createContractScheduleDocument,
  createPaymentReceipt,
} from '../src/features/recouvrement/documentModels'
import type { Echeance, Paiement, RecouvrementContrat } from '../src/features/recouvrement/types'

const client = {
  nom: 'Client test',
  adresse: '1 rue du Test',
  ville: 'Casablanca',
  ice: '123456789012345',
  telephone: '0612345678',
  email: 'client@example.ma',
}

const due = (overrides: Partial<Echeance> = {}): Echeance => ({
  id: 'contrat-1_2025-01',
  contratId: 'contrat-1',
  clientId: 'client-1',
  clientNomSnapshot: client.nom,
  libelle: 'Entretien janvier 2025',
  periodeDebut: '2025-01-01',
  periodeFin: '2025-01-31',
  dateEcheance: '2025-01-01',
  montantHT: 10_000,
  tvaPct: 0,
  montantTTC: 10_000,
  montantPaye: 4_000,
  statut: 'ouverte',
  notes: '',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  createdBy: 'director-1',
  updatedBy: 'director-1',
  ...overrides,
})

const payment: Paiement = {
  id: 'payment-1',
  numero: 'REC-2025-0001',
  date: '2025-01-15',
  clientId: 'client-1',
  client,
  montant: 4_000,
  mode: 'virement',
  reference: 'VIR-001',
  banque: '',
  affectations: [{ echeanceId: 'contrat-1_2025-01', libelle: 'Entretien janvier 2025', montant: 4_000 }],
  note: '',
  annule: false,
  createdAt: '2025-01-15T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
  createdBy: 'director-1',
  updatedBy: 'director-1',
}

describe('documents de recouvrement', () => {
  it('conserve le filigrane obligatoire ANNULÉ sur le reçu d’un paiement annulé', () => {
    const receipt = createPaymentReceipt(
      { ...payment, annule: true, motifAnnulation: 'Erreur de saisie', annuleLe: '2025-01-20' },
      defaultCompanySettings,
      10_000,
    )

    expect(receipt.watermarkText).toBe('ANNULÉ')
    expect(receipt.options.showWatermark).toBe(true)
    expect(receipt.conditions).toContain('Erreur de saisie')
  })

  it('présente le montant brut des échéances et ne compte pas les annulations dans la situation client', () => {
    const statement = createClientRecoveryStatement(
      defaultCompanySettings,
      client,
      [
        due(),
        due({
          id: 'contrat-1_2024-12',
          libelle: 'Échéance annulée',
          dateEcheance: '2024-12-01',
          montantTTC: 50_000,
          montantPaye: 0,
          statut: 'annulee',
        }),
      ],
      [payment],
      [],
      { jours0a30Cents: 6_000, jours31a60Cents: 0, jours61a90Cents: 0, plus90JoursCents: 0 },
      'REL-2025-0001',
    )
    const events = statement.sections.find((section) => section.id === 'statement-events')?.table?.rows ?? []

    expect(events).toHaveLength(2)
    expect(events.find((row) => row[1] === 'Échéance')?.[3]).toContain('100,00')
    expect(events.find((row) => row[1] === 'Paiement')?.[3]).toContain('40,00')
    expect(statement.notes).toContain('60,00')
  })

  it('exclut les échéances annulées du solde de l’échéancier contractuel', () => {
    const contract: RecouvrementContrat = {
      id: 'contrat-1',
      numero: 'CTR-2025-0001',
      clientId: 'client-1',
      client,
      ascenseursIds: [],
      ascenseursCodes: [],
      typePrestation: 'entretien',
      periodicite: 'mensuel',
      montantPeriodeHT: 10_000,
      tvaPct: 0,
      montantPeriodeTTC: 10_000,
      dateDebut: '2025-01-01',
      dateFin: '2025-12-31',
      jourEcheance: 1,
      modePaiementHabituel: 'virement',
      reconductionTacite: false,
      statut: 'actif',
      notes: '',
      archive: false,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      createdBy: 'director-1',
      updatedBy: 'director-1',
    }
    const schedule = createContractScheduleDocument(defaultCompanySettings, contract, [
      due(),
      due({ id: 'annulee', montantTTC: 50_000, montantPaye: 0, statut: 'annulee' }),
    ])
    const balance = schedule.sections[0].fields?.find((field) => field.id === 'balance')?.value

    expect(balance).toContain('60,00')
  })
})
