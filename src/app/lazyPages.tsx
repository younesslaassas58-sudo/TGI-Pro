import { lazy, Suspense, type ReactNode } from 'react'
import { LoadingScreen } from '@/components/layout/LoadingScreen'

export const ModulePage = lazy(async () =>
  import('@/app/pages/ModulePage').then((module) => ({ default: module.ModulePage })),
)

export const CompanySettingsPage = lazy(async () =>
  import('@/features/parametres/CompanySettingsPage').then((module) => ({
    default: module.CompanySettingsPage,
  })),
)

export const DocumentDemoPage = lazy(async () =>
  import('@/features/documents/DocumentDemoPage').then((module) => ({
    default: module.DocumentDemoPage,
  })),
)

export const DocumentEditorPage = lazy(async () =>
  import('@/features/documents/DocumentEditorPage').then((module) => ({ default: module.DocumentEditorPage })),
)

export const ClientsPage = lazy(async () =>
  import('@/features/clients/ClientsPage').then((module) => ({ default: module.ClientsPage })),
)

export const ClientDetailPage = lazy(async () =>
  import('@/features/clients/ClientDetailPage').then((module) => ({ default: module.ClientDetailPage })),
)

export const ParcPage = lazy(async () =>
  import('@/features/parc/ParcPage').then((module) => ({ default: module.ParcPage })),
)

export const AscenseurDetailPage = lazy(async () =>
  import('@/features/parc/AscenseurDetailPage').then((module) => ({ default: module.AscenseurDetailPage })),
)

export function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
}
