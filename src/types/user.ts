export type UserRole = 'directeur' | 'commercial' | 'technicien'
export type UserCivilite = 'M.' | 'Mme' | 'Mlle'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  civilite?: UserCivilite
  role: UserRole
  active: boolean
  photoURL?: string
  phone?: string
}
