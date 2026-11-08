export type RecouvrementPeriodicite =
  | 'mensuelle'
  | 'trimestrielle'
  | 'semestrielle'
  | 'annuelle'
  | 'mensuel'
  | 'trimestriel'
  | 'semestriel'
  | 'annuel'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'

export type RecouvrementStatutContrat = 'actif' | 'inactif' | 'annule' | 'suspendu' | 'resilie' | 'termine'
export type RecouvrementStatutEcheance = 'ouverte' | 'soldee' | 'annulee'
export type DerivedEcheanceStatus = 'a_venir' | 'due' | 'partielle' | 'en_retard' | 'soldee' | 'annulee'

export interface RecouvrementEcheance {
  id: string
  montantTTC: number
  montantPaye: number
  dateEcheance: string
  statut: RecouvrementStatutEcheance
  periodeDebut?: string
  periodeFin?: string
  contratId?: string
  montantHT?: number
  tvaPct?: number
  clientId?: string
  clientNomSnapshot?: string
  libelle?: string
}

export interface RecouvrementContrat {
  id: string
  dateDebut: string
  dateFin: string
  periodicite: RecouvrementPeriodicite
  jourEcheance: number | 'fin_de_mois'
  montantPeriodeHT: number
  tvaPct: number
  statut: RecouvrementStatutContrat
  indexationPct?: number
  numero?: string
  clientId?: string
  client?: { nom: string }
  typePrestation?: 'entretien' | 'maintenance_complete' | 'autre'
}

export interface RecouvrementAllocation {
  echeanceId: string
  montantCents: number
}

export interface RecouvrementPaiementResultat {
  allocations: RecouvrementAllocation[]
  echeances: RecouvrementEcheance[]
  montantAlloueCents: number
}

export interface RecouvrementSoldesAges {
  jours0a30Cents: number
  jours31a60Cents: number
  jours61a90Cents: number
  plus90JoursCents: number
  totalCents: number
}

const MONTHS_BY_PERIODICITY: Record<RecouvrementPeriodicite, number> = {
  mensuelle: 1,
  trimestrielle: 3,
  semestrielle: 6,
  annuelle: 12,
  mensuel: 1,
  trimestriel: 3,
  semestriel: 6,
  annuel: 12,
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
}

function parseIsoDate(value: string, field: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new RangeError(`${field} doit être une date ISO YYYY-MM-DD valide.`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`${field} doit être une date ISO YYYY-MM-DD valide.`)
  }
  return date
}

function assertCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} doit être un nombre entier de centimes positif ou nul.`)
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatEcheanceLabel(
  periodicite: RecouvrementPeriodicite,
  date: Date,
  prestation?: RecouvrementContrat['typePrestation'],
): string {
  const service = prestation === 'maintenance_complete'
    ? 'Maintenance complète'
    : prestation === 'autre' ? 'Prestation' : 'Entretien'
  const year = date.getUTCFullYear()
  if (['mensuelle', 'mensuel', 'monthly'].includes(periodicite)) {
    const month = new Intl.DateTimeFormat('fr-MA', { month: 'long', timeZone: 'UTC' }).format(date)
    return `${service} ${month} ${year}`
  }
  if (['trimestrielle', 'trimestriel', 'quarterly'].includes(periodicite)) {
    return `${service} · Trimestre T${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`
  }
  if (['semestrielle', 'semestriel', 'semiannual'].includes(periodicite)) {
    return `${service} · Semestre S${Math.floor(date.getUTCMonth() / 6) + 1} ${year}`
  }
  return `${service} · ${year}`
}

function dateForMonth(year: number, month: number, day: number | 'fin_de_mois'): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, day === 'fin_de_mois' ? lastDay : Math.min(day, lastDay)))
}

function monthOffset(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

function remainingCents(echeance: RecouvrementEcheance): number {
  return Math.max(0, echeance.montantTTC - echeance.montantPaye)
}

export function generateEcheances(
  contrat: RecouvrementContrat,
  jusquAu?: string,
): RecouvrementEcheance[] {
  const start = parseIsoDate(contrat.dateDebut, 'dateDebut')
  const end = parseIsoDate(
    jusquAu && (!contrat.dateFin || jusquAu < contrat.dateFin) ? jusquAu : contrat.dateFin,
    'dateFin',
  )
  assertCents(contrat.montantPeriodeHT, 'montantPeriodeHT')
  if (!Number.isFinite(contrat.tvaPct) || contrat.tvaPct < 0) {
    throw new RangeError('tvaPct doit être un nombre positif ou nul.')
  }
  if (contrat.jourEcheance !== 'fin_de_mois'
    && (!Number.isInteger(contrat.jourEcheance) || contrat.jourEcheance < 1 || contrat.jourEcheance > 31)) {
    throw new RangeError('jourEcheance doit être compris entre 1 et 31 ou égal à fin_de_mois.')
  }
  if (contrat.indexationPct !== undefined
    && (!Number.isFinite(contrat.indexationPct) || contrat.indexationPct < -100)) {
    throw new RangeError('indexationPct doit être un nombre fini supérieur ou égal à -100.')
  }
  if (end < start) throw new RangeError('dateFin doit être postérieure ou égale à dateDebut.')
  if (!MONTHS_BY_PERIODICITY[contrat.periodicite]) throw new RangeError('Périodicité non prise en charge.')
  if (contrat.statut !== 'actif') return []

  const interval = MONTHS_BY_PERIODICITY[contrat.periodicite]
  const result: RecouvrementEcheance[] = []
  for (let offset = 0; ; offset += interval) {
    const month = monthOffset(start, offset)
    const dueDate = dateForMonth(month.getUTCFullYear(), month.getUTCMonth(), contrat.jourEcheance)
    if (dueDate < start) continue
    if (dueDate > end) break

    let indexPeriods = 0
    if (contrat.indexationPct !== undefined) {
      for (let period = 1; ; period += 1) {
        const anniversaryMonth = monthOffset(start, period * 12)
        const anniversary = dateForMonth(
          anniversaryMonth.getUTCFullYear(),
          anniversaryMonth.getUTCMonth(),
          start.getUTCDate(),
        )
        if (anniversary > dueDate) break
        indexPeriods = period
      }
    }
    const montantHT = Math.round(
      contrat.montantPeriodeHT * (1 + (contrat.indexationPct ?? 0) / 100) ** indexPeriods,
    )
    const montantTTC = Math.round(montantHT * (1 + contrat.tvaPct / 100))
    const nextPeriodStart = monthOffset(start, offset + interval)
    const nextDueDate = dateForMonth(
      nextPeriodStart.getUTCFullYear(),
      nextPeriodStart.getUTCMonth(),
      contrat.jourEcheance,
    )
    const periodEnd = new Date(nextDueDate.getTime() - 86_400_000)
    const boundedPeriodEnd = periodEnd > end ? end : periodEnd
    const dateEcheance = formatDate(dueDate)

    const echeance: RecouvrementEcheance = {
      id: `${contrat.id}_${dateEcheance.slice(0, 7)}`,
      contratId: contrat.id,
      montantTTC,
      montantPaye: 0,
      dateEcheance,
      statut: 'ouverte',
      periodeDebut: dateEcheance,
      periodeFin: formatDate(boundedPeriodEnd),
    }
    if (contrat.clientId) {
      echeance.clientId = contrat.clientId
      echeance.clientNomSnapshot = contrat.client?.nom ?? ''
      echeance.montantHT = montantHT
      echeance.tvaPct = contrat.tvaPct
      echeance.libelle = formatEcheanceLabel(contrat.periodicite, dueDate, contrat.typePrestation)
    }
    result.push(echeance)
  }
  return result
}

export function deriveStatut(
  echeance: RecouvrementEcheance & {
    montantHT: number
    libelle: string
    clientId: string
    clientNomSnapshot: string
  },
  asOfDate: string,
): DerivedEcheanceStatus
export function deriveStatut(
  echeance: Pick<RecouvrementEcheance, 'montantTTC' | 'montantPaye' | 'dateEcheance' | 'statut'>,
  _asOfDate?: string,
): RecouvrementStatutEcheance
export function deriveStatut(
  echeance: Pick<RecouvrementEcheance, 'montantTTC' | 'montantPaye' | 'dateEcheance' | 'statut'>
    & Partial<Pick<RecouvrementEcheance, 'montantHT' | 'libelle' | 'clientId' | 'clientNomSnapshot'>>,
  asOfDate?: string,
): RecouvrementStatutEcheance | DerivedEcheanceStatus {
  if (echeance.statut === 'annulee') return 'annulee'
  assertCents(echeance.montantTTC, 'montantTTC')
  assertCents(echeance.montantPaye, 'montantPaye')
  const dueDate = parseIsoDate(echeance.dateEcheance, 'dateEcheance')
  if (asOfDate !== undefined) {
    const asOf = parseIsoDate(asOfDate, 'asOfDate')
    if (echeance.montantHT !== undefined) {
      if (echeance.montantPaye >= echeance.montantTTC) return 'soldee'
      if (echeance.montantPaye > 0) return 'partielle'
      if (dueDate > asOf) return 'a_venir'
      if (dueDate.getTime() === asOf.getTime()) return 'due'
      return 'en_retard'
    }
  }
  return echeance.montantPaye >= echeance.montantTTC ? 'soldee' : 'ouverte'
}

export function applyPaymentToEcheance<T extends RecouvrementEcheance>(
  echeance: T,
  montantCents: number,
): T {
  assertCents(montantCents, 'montantCents')
  if (echeance.statut === 'annulee') throw new RangeError('Une échéance annulée ne peut pas recevoir de paiement.')
  if (montantCents > remainingCents(echeance)) throw new RangeError('Le paiement dépasse le solde restant dû.')
  const updated = { ...echeance, montantPaye: echeance.montantPaye + montantCents }
  return { ...updated, statut: deriveStatut(updated) }
}

function applyAllocations(
  echeances: RecouvrementEcheance[],
  allocations: RecouvrementAllocation[],
): RecouvrementEcheance[] {
  const amounts = new Map<string, number>()
  for (const allocation of allocations) {
    amounts.set(allocation.echeanceId, (amounts.get(allocation.echeanceId) ?? 0) + allocation.montantCents)
  }
  return echeances.map((echeance) => {
    const next = { ...echeance, montantPaye: echeance.montantPaye + (amounts.get(echeance.id) ?? 0) }
    return { ...next, statut: deriveStatut(next) }
  })
}

export function allocatePaymentAutomatically(
  echeances: RecouvrementEcheance[],
  montantCents: number,
): RecouvrementPaiementResultat {
  assertCents(montantCents, 'montantCents')
  if (montantCents === 0) throw new RangeError('Le montant du paiement doit être supérieur à zéro.')
  const candidates = [...echeances]
    .filter((echeance) => echeance.statut !== 'annulee')
    .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance) || a.id.localeCompare(b.id))
  const totalOutstanding = candidates.reduce((total, echeance) => total + remainingCents(echeance), 0)
  if (montantCents > totalOutstanding) throw new RangeError('Le paiement dépasse le solde restant dû.')

  let remainder = montantCents
  const allocations: RecouvrementAllocation[] = []
  for (const echeance of candidates) {
    const montant = Math.min(remainingCents(echeance), remainder)
    if (montant > 0) allocations.push({ echeanceId: echeance.id, montantCents: montant })
    remainder -= montant
    if (remainder === 0) break
  }
  const updated = applyAllocations(echeances, allocations)
  return {
    allocations,
    echeances: updated,
    montantAlloueCents: allocations.reduce((sum, allocation) => sum + allocation.montantCents, 0),
  }
}

export function allocatePaymentManually(
  echeances: RecouvrementEcheance[],
  allocations: RecouvrementAllocation[],
): RecouvrementPaiementResultat {
  if (allocations.length === 0) throw new RangeError('Ajoutez au moins une affectation de paiement.')
  const byId = new Map(echeances.map((echeance) => [echeance.id, echeance]))
  const allocatedIds = new Set<string>()
  for (const allocation of allocations) {
    assertCents(allocation.montantCents, 'montantCents')
    if (allocation.montantCents === 0) throw new RangeError('Le montant alloué doit être supérieur à zéro.')
    if (allocatedIds.has(allocation.echeanceId)) throw new RangeError('Une échéance ne peut être allouée qu’une fois.')
    allocatedIds.add(allocation.echeanceId)
    const echeance = byId.get(allocation.echeanceId)
    if (!echeance || echeance.statut === 'annulee') throw new RangeError('Échéance inconnue ou annulée.')
    if (allocation.montantCents > remainingCents(echeance)) {
      throw new RangeError('L’allocation dépasse le solde restant de l’échéance.')
    }
  }
  const updated = applyAllocations(echeances, allocations)
  return {
    allocations: allocations.map((allocation) => ({ ...allocation })),
    echeances: updated,
    montantAlloueCents: allocations.reduce((sum, allocation) => sum + allocation.montantCents, 0),
  }
}

export function restorePaymentAllocations(
  echeances: RecouvrementEcheance[],
  allocations: RecouvrementAllocation[],
): RecouvrementEcheance[] {
  const amounts = new Map<string, number>()
  for (const allocation of allocations) {
    assertCents(allocation.montantCents, 'montantCents')
    if (allocation.montantCents === 0) throw new RangeError('Le montant alloué doit être supérieur à zéro.')
    amounts.set(allocation.echeanceId, (amounts.get(allocation.echeanceId) ?? 0) + allocation.montantCents)
  }
  for (const [id, amount] of amounts) {
    const echeance = echeances.find((item) => item.id === id)
    if (!echeance) throw new RangeError('Échéance inconnue.')
    if (amount > echeance.montantPaye) throw new RangeError('Le montant à restaurer dépasse le montant payé.')
  }
  return echeances.map((echeance) => {
    const amount = amounts.get(echeance.id) ?? 0
    const next = { ...echeance, montantPaye: echeance.montantPaye - amount }
    return { ...next, statut: deriveStatut(next) }
  })
}

export function calculateAgedBalances(
  echeances: RecouvrementEcheance[],
  asOfDate: string,
): RecouvrementSoldesAges {
  const asOf = parseIsoDate(asOfDate, 'asOfDate')
  const result: RecouvrementSoldesAges = {
    jours0a30Cents: 0,
    jours31a60Cents: 0,
    jours61a90Cents: 0,
    plus90JoursCents: 0,
    totalCents: 0,
  }
  for (const echeance of echeances) {
    if (echeance.statut === 'annulee') continue
    const dueDate = parseIsoDate(echeance.dateEcheance, 'dateEcheance')
    assertCents(echeance.montantTTC, 'montantTTC')
    assertCents(echeance.montantPaye, 'montantPaye')
    const balance = remainingCents(echeance)
    const ageDays = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000)
    if (balance === 0 || ageDays < 0) continue
    if (ageDays <= 30) result.jours0a30Cents += balance
    else if (ageDays <= 60) result.jours31a60Cents += balance
    else if (ageDays <= 90) result.jours61a90Cents += balance
    else result.plus90JoursCents += balance
    result.totalCents += balance
  }
  return result
}

export function balanceAgee(
  echeances: RecouvrementEcheance[],
  asOfDate: string,
): Record<'0-30' | '31-60' | '61-90' | '>90', number> {
  const aged = calculateAgedBalances(echeances, asOfDate)
  return {
    '0-30': aged.jours0a30Cents,
    '31-60': aged.jours31a60Cents,
    '61-90': aged.jours61a90Cents,
    '>90': aged.plus90JoursCents,
  }
}
