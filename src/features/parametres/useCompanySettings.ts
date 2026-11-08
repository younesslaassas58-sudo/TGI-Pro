import { useQuery } from '@tanstack/react-query'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { defaultCompanySettings } from './defaults'
import type { CompanySettings, DocumentNumberSetting, DocumentNumberType } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function mergeNumbering(
  value: unknown,
  type: DocumentNumberType,
): DocumentNumberSetting {
  const fallback = defaultCompanySettings.numbering[type]
  if (!isRecord(value)) return fallback
  return {
    prefix: typeof value.prefix === 'string' ? value.prefix : fallback.prefix,
    format: typeof value.format === 'string' ? value.format : fallback.format,
    counterLength:
      typeof value.counterLength === 'number' ? value.counterLength : fallback.counterLength,
    year: typeof value.year === 'number' ? value.year : fallback.year,
  }
}

function mergeSettings(value: unknown): CompanySettings {
  if (!isRecord(value)) return defaultCompanySettings

  const saved = value as Partial<CompanySettings>
  return {
    ...defaultCompanySettings,
    ...saved,
    phones: Array.isArray(saved.phones) ? saved.phones : defaultCompanySettings.phones,
    bankAccounts: Array.isArray(saved.bankAccounts)
      ? saved.bankAccounts
      : defaultCompanySettings.bankAccounts,
    images: isRecord(saved.images)
      ? { ...defaultCompanySettings.images, ...saved.images }
      : defaultCompanySettings.images,
    documentAppearance: {
      ...defaultCompanySettings.documentAppearance,
      ...(isRecord(saved.documentAppearance) ? saved.documentAppearance : {}),
    },
    numbering: {
      devis: mergeNumbering(saved.numbering?.devis, 'devis'),
      commande: mergeNumbering(saved.numbering?.commande, 'commande'),
      livraison: mergeNumbering(saved.numbering?.livraison, 'livraison'),
      facture: mergeNumbering(saved.numbering?.facture, 'facture'),
      recu: mergeNumbering(saved.numbering?.recu, 'recu'),
      intervention: mergeNumbering(saved.numbering?.intervention, 'intervention'),
      client: mergeNumbering(saved.numbering?.client, 'client'),
      ascenseur: mergeNumbering(saved.numbering?.ascenseur, 'ascenseur'),
      fiche_client: mergeNumbering(saved.numbering?.fiche_client, 'fiche_client'),
      fiche_ascenseur: mergeNumbering(saved.numbering?.fiche_ascenseur, 'fiche_ascenseur'),
      technicien: mergeNumbering(saved.numbering?.technicien, 'technicien'),
      fiche_technicien: mergeNumbering(saved.numbering?.fiche_technicien, 'fiche_technicien'),
    },
  }
}

export async function fetchCompanySettings(): Promise<CompanySettings> {
  const snapshot = await getDoc(doc(db, 'settings', 'company'))
  return snapshot.exists() ? mergeSettings(snapshot.data()) : defaultCompanySettings
}

export function useCompanySettings() {
  const query = useQuery({
    queryKey: ['company-settings'],
    queryFn: fetchCompanySettings,
    staleTime: 5 * 60 * 1000,
  })

  return {
    ...query,
    settings: query.data ?? defaultCompanySettings,
  }
}
