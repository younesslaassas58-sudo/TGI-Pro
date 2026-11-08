export type UserRole = 'directeur' | 'commercial' | 'technicien'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  role: UserRole
  active: boolean
  photoURL?: string
  phone?: string
}
