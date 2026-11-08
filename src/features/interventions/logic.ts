import type { Intervention, InterventionStatus } from './types'

const transitions: Record<InterventionStatus, readonly InterventionStatus[]> = {
  nouvelle: ['planifiee', 'annulee'],
  planifiee: ['en_cours', 'annulee'],
  en_cours: ['en_attente_pieces', 'terminee', 'annulee'],
  en_attente_pieces: ['en_cours', 'annulee'],
  terminee: ['cloturee', 'annulee'],
  cloturee: [],
  annulee: [],
}

export function transitionAutorisee(from: InterventionStatus, to: InterventionStatus): boolean {
  return transitions[from].includes(to)
}

export function assertTransition(from: InterventionStatus, to: InterventionStatus): void {
  if (!transitionAutorisee(from, to)) {
    throw new Error(`Transition impossible : ${from} vers ${to}.`)
  }
}

export function completionAllowed(item: Pick<Intervention, 'statut' | 'mouvementsStockGeneres'>): boolean {
  return ['en_cours', 'en_attente_pieces'].includes(item.statut) && !item.mouvementsStockGeneres
}

export function calculerDureeMinutes(start: string, end: string): number {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
    throw new RangeError('Les dates de début et de fin sont invalides.')
  }
  return Math.round((endTime - startTime) / 60_000)
}

export function interventionEnRetard(item: Pick<Intervention, 'datePrevue' | 'statut'>, today = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(item.datePrevue && item.datePrevue < today && !['terminee', 'cloturee', 'annulee'].includes(item.statut))
}

export function monthlyPlanKey(contractId: string, elevatorId: string, month: string): string {
  return `${contractId}_${elevatorId}_${month}`
}

export function filterExistingMonthlyVisitKeys(keys: ReadonlySet<string>, candidates: Array<{ contratId: string; ascenseurId: string; month: string }>) {
  const seen = new Set(keys)
  return candidates.filter((candidate) => {
    const key = monthlyPlanKey(candidate.contratId, candidate.ascenseurId, candidate.month)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
