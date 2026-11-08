import { describe, expect, it } from 'vitest'
import {
  assertTransition,
  calculerDureeMinutes,
  completionAllowed,
  filterExistingMonthlyVisitKeys,
  interventionEnRetard,
  monthlyPlanKey,
  transitionAutorisee,
} from '../src/features/interventions/logic'
import { defaultChecklist } from '../src/features/interventions/types'

describe('logique des interventions', () => {
  it('n’autorise que les transitions prévues et refuse une transition invalide', () => {
    expect(transitionAutorisee('planifiee', 'en_cours')).toBe(true)
    expect(transitionAutorisee('cloturee', 'en_cours')).toBe(false)
    expect(() => assertTransition('terminee', 'planifiee')).toThrow('Transition impossible')
  })

  it('calcule la durée de travail en minutes et rejette une plage inversée', () => {
    expect(calculerDureeMinutes('2026-03-10T08:15:00.000Z', '2026-03-10T09:05:00.000Z')).toBe(50)
    expect(() => calculerDureeMinutes('2026-03-10T09:00:00.000Z', '2026-03-10T08:00:00.000Z')).toThrow(RangeError)
  })

  it('détecte le retard uniquement pour les interventions encore ouvertes', () => {
    expect(interventionEnRetard({ datePrevue: '2026-03-09', statut: 'en_cours' }, '2026-03-10')).toBe(true)
    expect(interventionEnRetard({ datePrevue: '2026-03-10', statut: 'planifiee' }, '2026-03-10')).toBe(false)
    expect(interventionEnRetard({ datePrevue: '2026-03-09', statut: 'terminee' }, '2026-03-10')).toBe(false)
  })

  it('génère une clé mensuelle stable et élimine les visites déjà planifiées ou répétées', () => {
    expect(monthlyPlanKey('contrat-1', 'ascenseur-1', '2026-03')).toBe('contrat-1_ascenseur-1_2026-03')
    const candidates = [
      { contratId: 'c1', ascenseurId: 'a1', month: '2026-03' },
      { contratId: 'c2', ascenseurId: 'a2', month: '2026-03' },
      { contratId: 'c2', ascenseurId: 'a2', month: '2026-03' },
    ]
    expect(filterExistingMonthlyVisitKeys(new Set(['c1_a1_2026-03']), candidates)).toEqual([candidates[1]])
  })

  it('fournit une checklist métier pour chaque type d’intervention', () => {
    for (const type of ['depannage_urgent', 'entretien', 'reparation', 'installation', 'modernisation', 'controle', 'mise_en_service'] as const) {
      expect(defaultChecklist(type).length).toBeGreaterThan(0)
    }
    expect(defaultChecklist('depannage_urgent').some((item) => item.point.includes('Personne bloquée'))).toBe(true)
  })

  it('refuse la terminaison hors état actif et empêche un second traitement du stock', () => {
    expect(completionAllowed({ statut: 'en_cours', mouvementsStockGeneres: false })).toBe(true)
    expect(completionAllowed({ statut: 'terminee', mouvementsStockGeneres: false })).toBe(false)
    expect(completionAllowed({ statut: 'en_cours', mouvementsStockGeneres: true })).toBe(false)
  })
})
