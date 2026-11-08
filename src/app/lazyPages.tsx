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

export const TechniciensPage = lazy(async () =>
  import('@/features/techniciens/TechniciensPage').then((module) => ({ default: module.TechniciensPage })),
)

export const TechnicienDetailPage = lazy(async () =>
  import('@/features/techniciens/TechnicienDetailPage').then((module) => ({ default: module.TechnicienDetailPage })),
)

export const UtilisateursPage = lazy(async () =>
  import('@/features/utilisateurs/UtilisateursPage').then((module) => ({ default: module.UtilisateursPage })),
)

export const CataloguePage = lazy(async () =>
  import('@/features/catalogue/CataloguePage').then((module) => ({ default: module.CataloguePage })),
)

export const FournisseursPage = lazy(async () =>
  import('@/features/fournisseurs/FournisseursPage').then((module) => ({ default: module.FournisseursPage })),
)

export const DevisPage = lazy(async () =>
  import('@/features/devis/DevisPage').then((module) => ({ default: module.DevisPage })),
)

export const DevisPublicPage = lazy(async () =>
  import('@/features/devis/DevisPublicPage').then((module) => ({ default: module.DevisPublicPage })),
)

export const CommandesPage = lazy(async () =>
  import('@/features/commandes/CommandesPage').then((module) => ({ default: module.CommandesPage })),
)

export const LivraisonsPage = lazy(async () =>
  import('@/features/livraisons/LivraisonsPage').then((module) => ({ default: module.LivraisonsPage })),
)

export const RecouvrementPage = lazy(async () =>
  import('@/features/recouvrement/RecouvrementPage').then((module) => ({ default: module.RecouvrementPage })),
)

export const StockPage = lazy(async () =>
  import('@/features/stock/StockPage').then((module) => ({ default: module.StockPage })),
)

export const InterventionsPage = lazy(async () =>
  import('@/features/interventions/InterventionsPage').then((module) => ({ default: module.InterventionsPage })),
)

export const InterventionDetailPage = lazy(async () =>
  import('@/features/interventions/InterventionDetailPage').then((module) => ({ default: module.InterventionDetailPage })),
)

export function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
}
