import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { RoleGuard } from '@/components/layout/RoleGuard'
import { AccessDeniedPage } from '@/app/pages/AccessDeniedPage'
import { DashboardPage } from '@/app/pages/DashboardPage'
import { ModulePage } from '@/app/pages/ModulePage'
import { NotFoundPage } from '@/app/pages/NotFoundPage'
import { ProfilePage } from '@/app/pages/ProfilePage'
import { LoginPage } from '@/features/auth/LoginPage'

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
            <ModulePage title="Clients" description="Gérez les comptes et les contacts clients." />
          </RoleGuard>
        ),
      },
      {
        path: 'parc',
        element: (
          <RoleGuard module="parc">
            <ModulePage title="Parc d’ascenseurs" description="Consultez le parc des installations." />
          </RoleGuard>
        ),
      },
      {
        path: 'techniciens',
        element: (
          <RoleGuard module="techniciens">
            <ModulePage title="Techniciens" description="Retrouvez les équipes techniques." />
          </RoleGuard>
        ),
      },
      {
        path: 'interventions',
        element: (
          <RoleGuard module="interventions">
            <ModulePage title="Interventions" description="Suivez les opérations sur le terrain." />
          </RoleGuard>
        ),
      },
      {
        path: 'recouvrement',
        element: (
          <RoleGuard module="recouvrement">
            <ModulePage title="Recouvrement" description="Suivez les éléments de recouvrement." />
          </RoleGuard>
        ),
      },
      {
        path: 'devis',
        element: (
          <RoleGuard module="devis">
            <ModulePage title="Devis" description="Consultez et gérez les devis." />
          </RoleGuard>
        ),
      },
      {
        path: 'commandes',
        element: (
          <RoleGuard module="commandes">
            <ModulePage title="Bons de commande" description="Suivez les bons de commande." />
          </RoleGuard>
        ),
      },
      {
        path: 'livraisons',
        element: (
          <RoleGuard module="livraisons">
            <ModulePage title="Bons de livraison" description="Consultez les bons de livraison." />
          </RoleGuard>
        ),
      },
      {
        path: 'stock',
        element: (
          <RoleGuard module="stock">
            <ModulePage title="Stock" description="Consultez les articles et leur disponibilité." />
          </RoleGuard>
        ),
      },
      {
        path: 'parametres',
        element: (
          <RoleGuard module="parametres">
            <ModulePage title="Paramètres" description="Configuration de l’application." />
          </RoleGuard>
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
