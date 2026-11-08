import { useAuth } from './authStore'
import {
  hasPermission,
  type AppModule,
  type PermissionAction,
} from '@/lib/permissions'

export function usePermission(
  module: AppModule,
  action: PermissionAction,
  context?: { assignedToUid?: string },
): boolean {
  const role = useAuth((state) => state.profile?.role)
  const uid = useAuth((state) => state.user?.uid)
  if (
    role === 'technicien' &&
    module === 'interventions' &&
    action === 'modifier'
  ) {
    return Boolean(uid && context?.assignedToUid === uid)
  }
  return hasPermission(role, module, action)
}
