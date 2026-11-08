import type { UserProfile, UserRole } from '@/types/user'

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    directeur: 'Directeur',
    commercial: 'Commercial',
    technicien: 'Technicien',
  }
  return labels[role]
}

export function displayNameOrEmail(profile: Pick<UserProfile, 'displayName' | 'email'>): string {
  return profile.displayName.trim() || profile.email
}
