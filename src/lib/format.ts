import type { DocumentLine, DocumentTotals } from '@/features/documents/types'

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number): string {
  const formatted = currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
  return `${formatted.replace(/[\u202f\u00a0]/g, '\u00a0')} MAD`
}

export function formatDate(date: string | Date): string {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date
  if (Number.isNaN(value.getTime())) return ''
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} %`
}

function underHundred(value: number): string {
  const units = [
    'zéro',
    'un',
    'deux',
    'trois',
    'quatre',
    'cinq',
    'six',
    'sept',
    'huit',
    'neuf',
    'dix',
    'onze',
    'douze',
    'treize',
    'quatorze',
    'quinze',
    'seize',
  ]
  if (value <= 16) return units[value]
  if (value < 20) return `dix-${units[value - 10]}`
  if (value < 70) {
    const tens = Math.floor(value / 10) * 10
    const tensWords: Record<number, string> = {
      20: 'vingt',
      30: 'trente',
      40: 'quarante',
      50: 'cinquante',
      60: 'soixante',
    }
    const remainder = value % 10
    if (remainder === 0) return tensWords[tens]
    if (remainder === 1) return `${tensWords[tens]} et un`
    return `${tensWords[tens]}-${units[remainder]}`
  }
  if (value < 80) {
    if (value === 71) return 'soixante et onze'
    return `soixante-${underHundred(value - 60)}`
  }
  if (value === 80) return 'quatre-vingts'
  return `quatre-vingt-${underHundred(value - 80)}`
}

function underThousand(value: number): string {
  if (value < 100) return underHundred(value)
  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  const prefix = hundreds === 1 ? 'cent' : `${underHundred(hundreds)} cent`
  if (remainder === 0) return hundreds > 1 ? `${prefix}s` : prefix
  return `${prefix} ${underHundred(remainder)}`
}

function integerToFrench(value: number): string {
  if (value === 0) return 'zéro'
  const parts: string[] = []
  const millions = Math.floor(value / 1_000_000)
  const thousands = Math.floor((value % 1_000_000) / 1000)
  const remainder = value % 1000

  if (millions > 0) {
    parts.push(`${integerToFrench(millions)} million${millions > 1 ? 's' : ''}`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${underThousand(thousands)} mille`)
  }
  if (remainder > 0) parts.push(underThousand(remainder))
  return parts.join(' ')
}

export function numberToFrenchWords(amount: number): string {
  const cents = Math.round(Math.abs(Number.isFinite(amount) ? amount : 0) * 100)
  const whole = Math.floor(cents / 100)
  const centimes = cents % 100
  const currency = `${integerToFrench(whole)} dirham${whole > 1 ? 's' : ''}`
  const centsText =
    centimes === 0
      ? ''
      : ` et ${integerToFrench(centimes)} centime${centimes > 1 ? 's' : ''}`
  return `${amount < 0 ? 'moins ' : ''}${currency}${centsText}`
}

function toCents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100)
}

function fromCents(value: number): number {
  return value / 100
}

export function calculateTotals(lines: DocumentLine[]): DocumentTotals {
  let subtotalCents = 0
  let discountCents = 0
  const taxableByRate = new Map<number, number>()

  for (const line of lines) {
    const quantityHundredths = Math.max(0, Math.round(line.quantity * 100))
    const grossCents = Math.round((toCents(line.unitPriceHT) * quantityHundredths) / 100)
    const discount = Math.min(100, Math.max(0, line.discountPercent))
    const lineDiscountCents = Math.round((grossCents * discount) / 100)
    const taxableCents = grossCents - lineDiscountCents
    const rate = Math.max(0, line.vatPercent)

    subtotalCents += grossCents
    discountCents += lineDiscountCents
    taxableByRate.set(rate, (taxableByRate.get(rate) ?? 0) + taxableCents)
  }

  const vatByRate = [...taxableByRate.entries()]
    .sort(([rateA], [rateB]) => rateA - rateB)
    .map(([rate, taxableCents]) => ({
      rate,
      amount: fromCents(Math.round((taxableCents * rate) / 100)),
    }))
  const vatCents = vatByRate.reduce((total, entry) => total + toCents(entry.amount), 0)
  const totalHTCents = subtotalCents - discountCents

  return {
    subtotalHT: fromCents(subtotalCents),
    discounts: fromCents(discountCents),
    totalHT: fromCents(totalHTCents),
    vatByRate,
    totalVAT: fromCents(vatCents),
    totalTTC: fromCents(totalHTCents + vatCents),
  }
}
