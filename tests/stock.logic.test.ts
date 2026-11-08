import { describe, expect, it } from 'vitest'
import {
  calculerEcartInventaire,
  calculerAnnulationMouvement,
  calculerMouvement,
  calculerPMP,
  cleSourceMouvement,
  historiqueQuantites,
  mouvementDejaTraite,
  quantiteASuggerer,
  statutStock,
  valoriserStock,
} from '../src/features/stock/logic'

describe('logique de stock', () => {
  it('calcule le PMP en centimes pour un stock nul, un même coût et un coût différent', () => {
    expect(calculerPMP(0, 0, 12_345, 3)).toBe(12_345)
    expect(calculerPMP(12_345, 3, 12_345, 2)).toBe(12_345)
    expect(calculerPMP(10_000, 2, 15_000, 1)).toBe(11_667)
    expect(calculerPMP(1, 1, 2, 2)).toBe(2)
    expect(() => calculerPMP(1, 0, 2, 0)).toThrow('Les quantités doivent être positives et finies.')
  })

  it('distingue les statuts de stock et calcule les montants valorisés et suggérés', () => {
    const article = { seuilAlerte: 5, seuilMax: 20 }
    expect([0, 4, 5, 6, 20, 21].map((qty) => statutStock(article, qty)))
      .toEqual(['rupture', 'bas', 'bas', 'ok', 'ok', 'surstock'])
    expect(valoriserStock(2.5, 12_345)).toBe(30_863)
    expect(quantiteASuggerer(article, 6)).toBe(14)
    expect(quantiteASuggerer(article, 22)).toBe(0)
  })

  it('refuse un stock négatif sauf autorisation explicite et conserve le total lors d’un transfert', () => {
    expect(() => calculerMouvement({
      type: 'sortie', quantite: 3, quantiteSource: 2, quantiteDestination: 0,
      quantiteTotale: 2, pmpHT: 100, autoriserStockNegatif: false,
    })).toThrow('Stock insuffisant')
    const transferred = calculerMouvement({
      type: 'transfert', quantite: 2, quantiteSource: 5, quantiteDestination: 1,
      quantiteTotale: 6, pmpHT: 100,
    })
    expect(transferred.quantiteSource + transferred.quantiteDestination).toBe(6)
    expect(transferred.quantiteTotale).toBe(6)
    expect(calculerMouvement({
      type: 'sortie', quantite: 3, quantiteSource: 2, quantiteDestination: 0,
      quantiteTotale: 2, pmpHT: 100, autoriserStockNegatif: true,
    }).quantiteSource).toBe(-1)
  })

  it('calcule les écarts positifs et négatifs d’inventaire', () => {
    expect(calculerEcartInventaire(10, 12, 1_200)).toEqual({ ecart: 2, valeurEcart: 2_400 })
    expect(calculerEcartInventaire(10, 8, 1_200)).toEqual({ ecart: -2, valeurEcart: -2_400 })
  })

  it('empêche de retraiter une source documentaire déjà marquée', () => {
    const processed = new Set(['livraison-1'])
    expect(mouvementDejaTraite(processed, 'livraison-1')).toBe(true)
    expect(mouvementDejaTraite(processed, 'livraison-2')).toBe(false)
  })

  it('annule une entrée en restituant la quantité et le PMP avant achat', () => {
    const plan = calculerAnnulationMouvement({
      type: 'entree_achat',
      quantite: 2,
      quantiteSource: 0,
      quantiteDestination: 5,
      quantiteTotale: 5,
      pmpHT: 1_200,
      pmpAvant: 1_000,
      coutUnitaireHT: 1_500,
    })
    expect(plan).toMatchObject({
      quantiteDestination: 3,
      quantiteTotale: 3,
      pmpHT: 1_000,
      inverseType: 'sortie_manuelle',
    })
    expect(() => calculerAnnulationMouvement({
      type: 'entree_achat',
      quantite: 4,
      quantiteSource: 0,
      quantiteDestination: 3,
      quantiteTotale: 3,
      pmpHT: 1_200,
      pmpAvant: 1_000,
      coutUnitaireHT: 1_500,
    })).toThrow('Annulation impossible')
  })

  it('préserve une clé source déterministe pour empêcher les mouvements dupliqués', () => {
    const first = cleSourceMouvement('bon_livraison', 'bl/42', 'ligne-1')
    const repeated = cleSourceMouvement('bon_livraison', 'bl/42', 'ligne-1')
    const otherLine = cleSourceMouvement('bon_livraison', 'bl/42', 'ligne-2')
    expect(first).toBe(repeated)
    expect(first).not.toBe(otherLine)
    expect(first).toContain(encodeURIComponent('bl/42'))
  })

  it('reconstruit l’historique des quantités depuis le solde courant', () => {
    expect(historiqueQuantites(7, [
      { date: '2026-01-01T10:00:00Z', type: 'entree_achat', quantite: 10 },
      { date: '2026-01-02T10:00:00Z', type: 'sortie_livraison', quantite: 3 },
    ])).toEqual([
      { date: '2026-01-01T10:00:00Z', quantite: 10 },
      { date: '2026-01-02T10:00:00Z', quantite: 7 },
    ])
  })
})
