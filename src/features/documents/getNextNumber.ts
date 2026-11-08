import { doc, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { defaultCompanySettings } from '@/features/parametres/defaults'
import { fetchCompanySettings } from '@/features/parametres/useCompanySettings'
import type { DocumentNumberType } from '@/features/parametres/types'

export async function getNextNumber(type: DocumentNumberType): Promise<string> {
  const company = await fetchCompanySettings()
  const settings = company.numbering[type] ?? defaultCompanySettings.numbering[type]
  const year = new Date().getFullYear()
  const key = type === 'technicien' ? type : `${type}_${year}`
  const counterRef = doc(db, 'settings', 'counters', 'items', key)

  const value = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef)
    const currentValue = snapshot.exists() ? snapshot.data().value : 0
    if (typeof currentValue !== 'number' || !Number.isInteger(currentValue) || currentValue < 0) {
      throw new Error(`Compteur invalide pour le type de document « ${type} ».`)
    }

    const nextValue = currentValue + 1
    transaction.set(counterRef, { value: nextValue })
    return nextValue
  })

  const number = String(value).padStart(settings.counterLength, '0')
  return settings.format
    .replaceAll('{PREFIX}', settings.prefix)
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{NUM}', number)
}
