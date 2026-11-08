export type StockStatus = 'ok' | 'bas' | 'rupture' | 'surstock'

export interface StockThresholds {
  seuilAlerte?: number
  seuilMax?: number
}

export interface StockBalance {
  articleId: string
  depotId: string
  quantite: number
}

export interface StockMovePlan {
  type: 'entree' | 'sortie' | 'transfert' | 'ajustement'
  quantite: number
  quantiteSource: number
  quantiteDestination: number
  pmpHT: number
  quantiteTotale: number
  coutUnitaireHT?: number
  autoriserStockNegatif?: boolean
}

export function calculerPMP(
  pmpActuel: number,
  quantiteActuelle: number,
  coutEntrant: number,
  quantiteEntrante: number,
): number {
  if (![pmpActuel, coutEntrant].every(Number.isSafeInteger) || pmpActuel < 0 || coutEntrant < 0) {
    throw new RangeError('Les coûts doivent être des montants entiers de centimes positifs ou nuls.')
  }
  if (![quantiteActuelle, quantiteEntrante].every(Number.isFinite)
    || quantiteActuelle < 0 || quantiteEntrante <= 0) {
    throw new RangeError('Les quantités doivent être positives et finies.')
  }
  if (quantiteActuelle === 0) return coutEntrant
  return Math.round((pmpActuel * quantiteActuelle + coutEntrant * quantiteEntrante)
    / (quantiteActuelle + quantiteEntrante))
}

export function statutStock(article: StockThresholds, quantiteTotale: number): StockStatus {
  if (!Number.isFinite(quantiteTotale)) throw new RangeError('La quantité totale doit être finie.')
  if (quantiteTotale <= 0) return 'rupture'
  if (article.seuilAlerte !== undefined && quantiteTotale <= article.seuilAlerte) return 'bas'
  if (article.seuilMax !== undefined && quantiteTotale > article.seuilMax) return 'surstock'
  return 'ok'
}

export function valoriserStock(quantite: number, pmpHT: number): number {
  if (!Number.isFinite(quantite) || !Number.isSafeInteger(pmpHT) || pmpHT < 0) {
    throw new RangeError('Quantité ou PMP invalide.')
  }
  return Math.round(quantite * pmpHT)
}

export function quantiteASuggerer(
  article: StockThresholds,
  quantiteActuelle: number,
): number {
  if (!Number.isFinite(quantiteActuelle)) throw new RangeError('La quantité actuelle doit être finie.')
  return Math.max(0, (article.seuilMax ?? 0) - quantiteActuelle)
}

export function calculerMouvement(plan: StockMovePlan): {
  quantiteSource: number
  quantiteDestination: number
  pmpHT: number
  quantiteTotale: number
  valeurEcart: number
} {
  if (!Number.isFinite(plan.quantite) || plan.quantite <= 0) throw new RangeError('La quantité doit être supérieure à zéro.')
  let source = plan.quantiteSource
  let destination = plan.quantiteDestination
  let quantityTotal = plan.quantiteTotale
  let pmp = plan.pmpHT
  if (![source, destination, quantityTotal].every(Number.isFinite) || quantityTotal < 0) {
    throw new RangeError('Les niveaux de stock doivent être valides.')
  }

  if (plan.type === 'entree') {
    if (!Number.isSafeInteger(plan.coutUnitaireHT) || (plan.coutUnitaireHT ?? -1) < 0) {
      throw new RangeError('Le coût unitaire d’entrée est invalide.')
    }
    pmp = calculerPMP(pmp, quantityTotal, plan.coutUnitaireHT ?? 0, plan.quantite)
    destination += plan.quantite
    quantityTotal += plan.quantite
  } else if (plan.type === 'sortie') {
    source -= plan.quantite
    quantityTotal -= plan.quantite
  } else if (plan.type === 'transfert') {
    source -= plan.quantite
    destination += plan.quantite
  } else {
    const delta = plan.quantite
    source += delta
    quantityTotal += delta
  }

  if (plan.type !== 'entree' && plan.type !== 'ajustement'
    && source < 0 && !plan.autoriserStockNegatif) {
    throw new RangeError('Stock insuffisant : l’opération rendrait le stock négatif.')
  }
  if (plan.type === 'sortie') quantityTotal = Math.max(0, quantityTotal)
  return {
    quantiteSource: source,
    quantiteDestination: destination,
    pmpHT: pmp,
    quantiteTotale: quantityTotal,
    valeurEcart: Math.round((source - plan.quantiteSource) * pmp),
  }
}

export function mouvementDejaTraite(
  sourcesTraitees: ReadonlySet<string>,
  sourceId: string,
): boolean {
  return sourcesTraitees.has(sourceId)
}

export function cleSourceMouvement(type: string, documentId: string, sourceLineId: string): string {
  return `source_${encodeURIComponent(type)}_${encodeURIComponent(documentId)}_${encodeURIComponent(sourceLineId)}`
}

export function historiqueQuantites(
  currentQuantity: number,
  movements: Array<{ date: string; type: string; direction?: 'entree' | 'sortie'; quantite: number }>,
): Array<{ date: string; quantite: number }> {
  if (!Number.isFinite(currentQuantity) || currentQuantity < 0
    || movements.some((movement) => !Number.isFinite(movement.quantite) || movement.quantite < 0)) {
    throw new RangeError('Les données de l’historique de stock sont invalides.')
  }
  let balance = currentQuantity
  const reversePoints = [...movements].sort((left, right) => right.date.localeCompare(left.date)).map((movement) => {
    const increases = ['entree_achat', 'entree_retour', 'entree_manuelle'].includes(movement.type)
      || (movement.type === 'ajustement_inventaire' && movement.direction === 'entree')
    const decreases = ['sortie_livraison', 'sortie_intervention', 'sortie_manuelle', 'casse_perte'].includes(movement.type)
      || (movement.type === 'ajustement_inventaire' && movement.direction === 'sortie')
    if (increases) balance -= movement.quantite
    else if (decreases) balance += movement.quantite
    return { date: movement.date, quantite: balance + (increases ? movement.quantite : decreases ? -movement.quantite : 0) }
  })
  return reversePoints.reverse()
}

export interface CancellationPlanInput {
  type: 'entree_achat' | 'entree_retour' | 'entree_manuelle' | 'sortie_livraison' |
    'sortie_intervention' | 'sortie_manuelle' | 'transfert' | 'ajustement_inventaire' | 'casse_perte'
  direction?: 'entree' | 'sortie'
  quantite: number
  quantiteSource: number
  quantiteDestination: number
  quantiteTotale: number
  pmpHT: number
  pmpAvant: number
  coutUnitaireHT?: number
}

export interface CancellationPlan {
  quantiteSource: number
  quantiteDestination: number
  quantiteTotale: number
  pmpHT: number
  inverseType: CancellationPlanInput['type']
  inverseDirection?: 'entree' | 'sortie'
}

export function calculerAnnulationMouvement(input: CancellationPlanInput): CancellationPlan {
  if (![input.quantite, input.quantiteSource, input.quantiteDestination, input.quantiteTotale]
    .every(Number.isFinite) || input.quantite <= 0 || input.quantiteTotale < 0) {
    throw new RangeError('Les quantités du mouvement à annuler sont invalides.')
  }
  const inbound = ['entree_achat', 'entree_manuelle', 'entree_retour'].includes(input.type)
  const outbound = ['sortie_livraison', 'sortie_intervention', 'sortie_manuelle', 'casse_perte'].includes(input.type)
  const transfer = input.type === 'transfert'
  const adjustmentEntry = input.type === 'ajustement_inventaire' && input.direction === 'entree'
  const adjustmentExit = input.type === 'ajustement_inventaire' && input.direction === 'sortie'
  const nextSource = input.quantiteSource + (outbound || transfer || adjustmentExit ? input.quantite : 0)
  const nextDestination = input.quantiteDestination - (inbound || transfer || adjustmentEntry ? input.quantite : 0)
  const quantityDelta = inbound || adjustmentEntry
    ? -input.quantite
    : outbound || adjustmentExit ? input.quantite : 0
  const nextTotal = input.quantiteTotale + quantityDelta
  if (nextSource < 0 || nextDestination < 0 || nextTotal < 0) {
    throw new RangeError('Annulation impossible : elle rendrait un niveau de stock négatif.')
  }
  const nextPmp = inbound && nextTotal > 0
    ? Math.round((input.pmpHT * input.quantiteTotale
      - (input.coutUnitaireHT ?? input.pmpAvant) * input.quantite) / nextTotal)
    : nextTotal === 0 ? input.pmpAvant : input.pmpHT
  if (!Number.isSafeInteger(nextPmp) || nextPmp < 0) {
    throw new RangeError('Annulation impossible : le PMP recalculé est invalide.')
  }
  const inverseType = inbound
    ? 'sortie_manuelle'
    : transfer ? 'transfert'
      : adjustmentEntry || adjustmentExit ? 'ajustement_inventaire'
        : 'entree_retour'
  return {
    quantiteSource: nextSource,
    quantiteDestination: nextDestination,
    quantiteTotale: nextTotal,
    pmpHT: nextPmp,
    inverseType,
    ...(input.type === 'ajustement_inventaire'
      ? { inverseDirection: adjustmentEntry ? 'sortie' as const : 'entree' as const }
      : {}),
  }
}

export function calculerEcartInventaire(
  theorique: number,
  comptee: number,
  coutUnitaireHT: number,
): { ecart: number; valeurEcart: number } {
  if (![theorique, comptee].every(Number.isFinite)) throw new RangeError('Les quantités d’inventaire sont invalides.')
  return { ecart: comptee - theorique, valeurEcart: Math.round((comptee - theorique) * coutUnitaireHT) }
}
