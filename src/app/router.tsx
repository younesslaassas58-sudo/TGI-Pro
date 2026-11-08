import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RoleGuard } from '@/components/layout/RoleGuard'
import { AccessDeniedPage } from '@/app/pages/AccessDeniedPage'
import { DashboardPage } from '@/app/pages/DashboardPage'
import { ProfilePage } from '@/app/pages/ProfilePage'
import { LoginPage } from '@/features/auth/LoginPage'
import {
  AscenseurDetailPage,
  ClientDetailPage,
  ClientsPage,
  CompanySettingsPage,
  CataloguePage,
  CommandesPage,
  DocumentDemoPage,
  DocumentEditorPage,
  DevisPage,
  DevisPublicPage,
  FournisseursPage,
  InterventionDetailPage,
  InterventionsPage,
  LazyPage,
  LivraisonsPage,
  ParcPage,
  RecouvrementPage,
  StockPage,
  TechnicienDetailPage,
  TechniciensPage,
  UtilisateursPage,
} from '@/app/lazyPages'
import { NotFoundPage } from '@/app/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/devis/public/:token',
    element: <LazyPage><DevisPublicPage /></LazyPage>,
  },
  {
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'clients',
        element: (
          <RoleGuard module="clients">
            <LazyPage><ClientsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'clients/:id',
        element: (
          <RoleGuard module="clients">
            <LazyPage><ClientDetailPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'parc',
        element: (
          <RoleGuard module="parc">
            <LazyPage><ParcPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'parc/:id',
        element: (
          <RoleGuard module="parc">
            <LazyPage><AscenseurDetailPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'techniciens',
        element: (
          <RoleGuard module="techniciens">
            <LazyPage><TechniciensPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'techniciens/:id',
        element: (
          <RoleGuard module="techniciens">
            <LazyPage><TechnicienDetailPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'utilisateurs',
        element: (
          <RoleGuard module="utilisateurs">
            <LazyPage><UtilisateursPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'catalogue',
        element: (
          <RoleGuard module="catalogue">
            <LazyPage><CataloguePage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'fournisseurs',
        element: (
          <RoleGuard module="fournisseurs">
            <LazyPage><FournisseursPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'interventions',
        element: (
          <RoleGuard module="interventions">
            <LazyPage><InterventionsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'interventions/:id',
        element: (
          <RoleGuard module="interventions">
            <LazyPage><InterventionDetailPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'recouvrement',
        element: (
          <RoleGuard module="recouvrement">
            <LazyPage><RecouvrementPage /></LazyPage>
          </RoleGuard>
        ),
      },
      ...['contrats', 'echeances', 'paiements'].map((section) => ({
        path: `recouvrement/${section}`,
        element: (
          <RoleGuard module="recouvrement">
            <LazyPage><RecouvrementPage /></LazyPage>
          </RoleGuard>
        ),
      })),
      {
        path: 'recouvrement/contrats/:contratId',
        element: (
          <RoleGuard module="recouvrement">
            <LazyPage><RecouvrementPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'recouvrement/clients/:clientId',
        element: (
          <RoleGuard module="recouvrement">
            <LazyPage><RecouvrementPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'devis',
        element: (
          <RoleGuard module="devis">
            <LazyPage><DevisPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'commandes',
        element: (
          <RoleGuard module="commandes">
            <LazyPage><CommandesPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'livraisons',
        element: (
          <RoleGuard module="livraisons">
            <LazyPage><LivraisonsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'stock',
        element: (
          <RoleGuard module="stock">
            <LazyPage><StockPage /></LazyPage>
          </RoleGuard>
        ),
      },
      ...['articles', 'mouvements', 'depots', 'inventaires'].map((section) => ({
        path: `stock/${section}`,
        element: (
          <RoleGuard module="stock">
            <LazyPage><StockPage /></LazyPage>
          </RoleGuard>
        ),
      })),
      ...['articles/:articleId', 'depots/:depotId', 'inventaires/:inventoryId'].map((path) => ({
        path: `stock/${path}`,
        element: (
          <RoleGuard module="stock">
            <LazyPage><StockPage /></LazyPage>
          </RoleGuard>
        ),
      })),
      {
        path: 'parametres',
        element: (
          <RoleGuard module="parametres">
            <LazyPage><CompanySettingsPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'documents/demo',
        element: (
          <RoleGuard module="devis">
            <LazyPage><DocumentDemoPage /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'documents/editor',
        element: (
          <LazyPage><DocumentEditorPage /></LazyPage>
        ),
      },
      { path: 'profil', element: <ProfilePage /> },
      { path: 'acces-refuse', element: <AccessDeniedPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
