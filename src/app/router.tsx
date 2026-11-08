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
  DocumentDemoPage,
  DocumentEditorPage,
  LazyPage,
  ModulePage,
  ParcPage,
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
        path: 'interventions',
        element: (
          <RoleGuard module="interventions">
            <LazyPage><ModulePage title="Interventions" description="Suivez les opérations sur le terrain." /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'recouvrement',
        element: (
          <RoleGuard module="recouvrement">
            <LazyPage><ModulePage title="Recouvrement" description="Suivez les éléments de recouvrement." /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'devis',
        element: (
          <RoleGuard module="devis">
            <LazyPage><ModulePage title="Devis" description="Consultez et gérez les devis." /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'commandes',
        element: (
          <RoleGuard module="commandes">
            <LazyPage><ModulePage title="Bons de commande" description="Suivez les bons de commande." /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'livraisons',
        element: (
          <RoleGuard module="livraisons">
            <LazyPage><ModulePage title="Bons de livraison" description="Consultez les bons de livraison." /></LazyPage>
          </RoleGuard>
        ),
      },
      {
        path: 'stock',
        element: (
          <RoleGuard module="stock">
            <LazyPage><ModulePage title="Stock" description="Consultez les articles et leur disponibilité." /></LazyPage>
          </RoleGuard>
        ),
      },
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
