import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { AppModule } from '@/lib/permissions'
import { usePermission } from '@/features/auth/usePermission'

export interface RoleGuardProps {
  module: AppModule
  children: ReactNode
}

export function RoleGuard({ module, children }: RoleGuardProps) {
  const canView = usePermission(module, 'voir')
  if (!canView) return <Navigate to="/acces-refuse" replace />
  return children
}
