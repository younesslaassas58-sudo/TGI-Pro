import { describe, expect, it } from 'vitest'
import {
  applyPaymentToEcheance,
  allocatePaymentAutomatically,
  allocatePaymentManually,
  calculateAgedBalances,
  deriveStatut,
  generateEcheances,
  restorePaymentAllocations,
  type RecouvrementContrat,
  type RecouvrementEcheance,
} from '../src/features/recouvrement/logic'

const activeContract = (overrides: Partial<RecouvrementContrat> = {}): RecouvrementContrat => ({
  id: 'contrat-1',
  dateDebut: '2025-01-01',
  dateFin: '2025-12-31',
  periodicite: 'mensuelle',
  jourEcheance: 1,
  montantPeriodeHT: 10_000,
  tvaPct: 20,
  statut: 'actif',
  ...overrides,
})

const echeance = (
  id: string,
  dateEcheance: string,
  montantTTC: number,
  montantPaye = 0,
  statut: RecouvrementEcheance['statut'] = 'ouverte',
): RecouvrementEcheance => ({
  id,
  dateEcheance,
  montantTTC,
  montantPaye,
  statut,
})

describe('generateEcheances', () => {
  it.each([
    ['mensuelle', 1, 12],
    ['trimestrielle', 3, 4],
    ['semestrielle', 6, 2],
    ['annuelle', 12, 1],
  ] as const)('génère la cadence %s dans les bornes', (periodicite, interval, count) => {
    const result = generateEcheances(activeContract({
      periodicite,
      dateFin: '2025-12-31',
      montantPeriodeHT: 1_000,
      tvaPct: 0,
    }))

    expect(result).toHaveLength(count)
    expect(result[0].dateEcheance).toBe('2025-01-01')
    expect(result.at(-1)?.dateEcheance).toBe(`2025-${String(1 + (count - 1) * interval).padStart(2, '0')}-01`)
    expect(result.every((item) => item.statut === 'ouverte' && item.montantTTC === 1_000)).toBe(true)
  })

  it('borne les jours 31 en fin de mois, y compris en février', () => {
    const result = generateEcheances(activeContract({
      dateDebut: '2025-01-01',
      dateFin: '2025-03-31',
      jourEcheance: 31,
      montantPeriodeHT: 100,
      tvaPct: 0,
    }))
    expect(result.map((item) => item.dateEcheance)).toEqual([
      '2025-01-31',
      '2025-02-28',
      '2025-03-31',
    ])

    const endOfMonth = generateEcheances(activeContract({
      dateFin: '2025-03-31',
      jourEcheance: 'fin_de_mois',
      montantPeriodeHT: 100,
      tvaPct: 0,
    }))
    expect(endOfMonth.map((item) => item.dateEcheance)).toEqual(result.map((item) => item.dateEcheance))
  })

  it('utilise le mois de l’échéance dans son identifiant et limite un contrat sans fin à la date demandée', () => {
    const contract = activeContract({
      dateDebut: '2025-01-15',
      dateFin: '',
      jourEcheance: 1,
      montantPeriodeHT: 100,
      tvaPct: 0,
    })

    expect(generateEcheances(contract, '2025-03-31').map((item) => [item.id, item.dateEcheance])).toEqual([
      ['contrat-1_2025-02', '2025-02-01'],
      ['contrat-1_2025-03', '2025-03-01'],
    ])
    expect(generateEcheances(contract, '2025-03-31')).toEqual(generateEcheances(contract, '2025-03-31'))
  })

  it('respects contract bounds, taxable amounts, and annual indexation in integer cents', () => {
    const result = generateEcheances(activeContract({
      dateDebut: '2025-01-15',
      dateFin: '2026-02-01',
      periodicite: 'mensuelle',
      jourEcheance: 1,
      montantPeriodeHT: 10_001,
      tvaPct: 20,
      indexationPct: 10,
    }))

    expect(result[0].dateEcheance).toBe('2025-02-01')
    expect(result.at(-1)?.dateEcheance).toBe('2026-02-01')
    expect(result[0].montantTTC).toBe(12_001)
    expect(result.find((item) => item.dateEcheance === '2026-01-01')?.montantTTC).toBe(12_001)
    expect(result.find((item) => item.dateEcheance === '2026-02-01')?.montantTTC).toBe(13_201)
    expect(result.every((item) => item.periodeDebut && item.periodeFin)).toBe(true)
  })

  it('ne génère pas d’échéances pour un contrat inactif ou annulé', () => {
    expect(generateEcheances(activeContract({ statut: 'inactif' }))).toEqual([])
    expect(generateEcheances(activeContract({ statut: 'annule' }))).toEqual([])
  })
})

describe('statut et allocation des paiements', () => {
  it('dérive tous les statuts à venir, à échéance, partiel, en retard, soldé et annulé', () => {
    const datedDue = (id: string, date: string, paid = 0, status: RecouvrementEcheance['statut'] = 'ouverte') => ({
      ...echeance(id, date, 100, paid, status),
      montantHT: 100,
      libelle: id,
      clientId: 'client-1',
      clientNomSnapshot: 'Client',
    })
    expect(deriveStatut(datedDue('future', '2025-01-02'), '2025-01-01')).toBe('a_venir')
    expect(deriveStatut(datedDue('today', '2025-01-01'), '2025-01-01')).toBe('due')
    expect(deriveStatut(datedDue('partial', '2025-01-01', 20), '2025-01-01')).toBe('partielle')
    expect(deriveStatut(datedDue('late', '2024-12-31'), '2025-01-01')).toBe('en_retard')
    expect(deriveStatut(datedDue('paid', '2024-12-31', 100), '2025-01-01')).toBe('soldee')
    expect(deriveStatut(datedDue('cancelled', '2024-12-31', 0, 'annulee'), '2025-01-01')).toBe('annulee')
    expect(applyPaymentToEcheance(echeance('partial', '2025-01-01', 100), 40)).toMatchObject({
      montantPaye: 40,
      statut: 'ouverte',
    })
    expect(() => applyPaymentToEcheance(echeance('over', '2025-01-01', 100), 101))
      .toThrow('Le paiement dépasse le solde restant dû.')
  })

  it('alloue automatiquement aux plus anciennes, au centime près, et refuse le trop-perçu', () => {
    const input = [
      echeance('later', '2025-02-01', 600),
      echeance('earlier', '2025-01-01', 500, 100),
      echeance('cancelled', '2024-12-01', 900, 0, 'annulee'),
    ]
    const result = allocatePaymentAutomatically(input, 700)

    expect(result.allocations).toEqual([
      { echeanceId: 'earlier', montantCents: 400 },
      { echeanceId: 'later', montantCents: 300 },
    ])
    expect(result.montantAlloueCents).toBe(700)
    expect(result.echeances.map(({ id, montantPaye, statut }) => [id, montantPaye, statut])).toEqual([
      ['later', 300, 'ouverte'],
      ['earlier', 500, 'soldee'],
      ['cancelled', 0, 'annulee'],
    ])
    expect(() => allocatePaymentAutomatically(input, 1_001)).toThrow('Le paiement dépasse le solde restant dû.')
    expect(() => allocatePaymentAutomatically(input, 0)).toThrow('Le montant du paiement doit être supérieur à zéro.')
  })

  it('accepte les allocations manuelles partielles, refuse un dépassement et restaure le paiement', () => {
    const input = [echeance('a', '2025-01-01', 500), echeance('b', '2025-02-01', 1_000)]
    const result = allocatePaymentManually(input, [
      { echeanceId: 'b', montantCents: 400 },
      { echeanceId: 'a', montantCents: 200 },
    ])
    expect(result.montantAlloueCents).toBe(600)
    expect(result.echeances.map((item) => item.montantPaye)).toEqual([200, 400])
    expect(() => allocatePaymentManually(input, [{ echeanceId: 'a', montantCents: 501 }]))
      .toThrow('L’allocation dépasse le solde restant de l’échéance.')
    expect(() => allocatePaymentManually(input, [])).toThrow('Ajoutez au moins une affectation de paiement.')

    expect(restorePaymentAllocations(result.echeances, result.allocations)).toEqual(input)
  })
})

describe('calculateAgedBalances', () => {
  it('répartit les soldes impayés par ancienneté et exclut le futur et les annulations', () => {
    const items = [
      echeance('0-30', '2024-12-22', 1_000, 200),
      echeance('31-60', '2024-11-22', 2_000),
      echeance('61-90', '2024-10-23', 3_000),
      echeance('90+', '2024-10-22', 4_000),
      echeance('future', '2025-01-22', 5_000),
      echeance('cancelled', '2024-01-01', 6_000, 0, 'annulee'),
    ]

    expect(calculateAgedBalances(items, '2025-01-21')).toEqual({
      jours0a30Cents: 800,
      jours31a60Cents: 2_000,
      jours61a90Cents: 3_000,
      plus90JoursCents: 4_000,
      totalCents: 9_800,
    })
  })
})
