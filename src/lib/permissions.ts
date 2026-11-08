import type { UserRole } from '@/types/user'

export type AppModule =
  | 'clients'
  | 'parc'
  | 'techniciens'
  | 'utilisateurs'
  | 'interventions'
  | 'recouvrement'
  | 'devis'
  | 'commandes'
  | 'livraisons'
  | 'stock'
  | 'parametres'

export type PermissionAction = 'voir' | 'creer' | 'modifier' | 'supprimer'
export type ModulePermissions = Record<PermissionAction, boolean>
export type PermissionMatrix = Record<AppModule, ModulePermissions>

const noAccess: ModulePermissions = {
  voir: false,
  creer: false,
  modifier: false,
  supprimer: false,
}

const readOnly: ModulePermissions = {
  voir: true,
  creer: false,
  modifier: false,
  supprimer: false,
}

const manageWithoutDelete: ModulePermissions = {
  voir: true,
  creer: true,
  modifier: true,
  supprimer: false,
}

const fullAccess: ModulePermissions = {
  voir: true,
  creer: true,
  modifier: true,
  supprimer: true,
}

function matrixFor(
  grants: Partial<Record<AppModule, ModulePermissions>>,
): PermissionMatrix {
  return {
    clients: grants.clients ?? noAccess,
    parc: grants.parc ?? noAccess,
    techniciens: grants.techniciens ?? noAccess,
    utilisateurs: grants.utilisateurs ?? noAccess,
    interventions: grants.interventions ?? noAccess,
    recouvrement: grants.recouvrement ?? noAccess,
    devis: grants.devis ?? noAccess,
    commandes: grants.commandes ?? noAccess,
    livraisons: grants.livraisons ?? noAccess,
    stock: grants.stock ?? noAccess,
    parametres: grants.parametres ?? noAccess,
  }
}

export const permissions: Record<UserRole, PermissionMatrix> = {
  directeur: matrixFor({
    clients: fullAccess,
    parc: fullAccess,
    techniciens: fullAccess,
    utilisateurs: fullAccess,
    interventions: fullAccess,
    recouvrement: fullAccess,
    devis: fullAccess,
    commandes: fullAccess,
    livraisons: fullAccess,
    stock: fullAccess,
    parametres: fullAccess,
  }),
  commercial: matrixFor({
    clients: manageWithoutDelete,
    parc: manageWithoutDelete,
    techniciens: readOnly,
    interventions: readOnly,
    recouvrement: {
      voir: true,
      creer: true,
      modifier: true,
      supprimer: false,
    },
    devis: fullAccess,
    commandes: fullAccess,
    livraisons: fullAccess,
    stock: readOnly,
  }),
  technicien: matrixFor({
    clients: readOnly,
    parc: readOnly,
    techniciens: readOnly,
    interventions: {
      voir: true,
      creer: false,
      modifier: true,
      supprimer: false,
    },
    stock: readOnly,
  }),
}

export function hasPermission(
  role: UserRole | undefined,
  module: AppModule,
  action: PermissionAction,
): boolean {
  return role ? permissions[role][module][action] : false
}
