import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { apiPost } from '@/lib/api'
import type { UserCivilite, UserRole } from '@/types/user'

export interface ManagedUser {
  uid: string
  displayName: string
  email: string
  role: UserRole
  active: boolean
  civilite: UserCivilite
  phone: string
  photoURL: string
  lastSignInAt: string
}

const usersKey = ['managed-users']

export function useManagedUsers() {
  return useQuery({
    queryKey: usersKey,
    queryFn: async (): Promise<ManagedUser[]> => {
      const snapshot = await getDocs(collection(db, 'users'))
      return snapshot.docs.flatMap((item) => {
        const data = item.data()
        if (data.role !== 'directeur' && data.role !== 'commercial' && data.role !== 'technicien') return []
        return [{
          uid: item.id,
          displayName: typeof data.displayName === 'string' ? data.displayName : '',
          email: typeof data.email === 'string' ? data.email : '',
          role: data.role,
          active: data.active === true,
          civilite: data.civilite === 'Mme' || data.civilite === 'Mlle' ? data.civilite : 'M.',
          phone: typeof data.phone === 'string' ? data.phone : '',
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
          lastSignInAt: typeof data.lastSignInAt === 'string'
            ? data.lastSignInAt
            : data.lastSignInAt instanceof Timestamp
              ? data.lastSignInAt.toDate().toISOString()
              : '',
        }]
      })
    },
  })
}

export interface CreateUserPayload {
  email: string
  password: string
  displayName: string
  civilite: UserCivilite
  role: UserRole
  telephone: string
  technicienId: string
}

export type UpdateUserPayload = Omit<CreateUserPayload, 'email' | 'password' | 'technicienId'> & {
  uid: string
  active: boolean
}

export function useCreateManagedUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserPayload) => apiPost<{ uid: string }>('/api/users/create', body),
    onSuccess: () => client.invalidateQueries({ queryKey: usersKey }),
  })
}

export function useUpdateManagedUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateUserPayload) => apiPost<{ uid: string }>('/api/users/update', body),
    onSuccess: () => client.invalidateQueries({ queryKey: usersKey }),
  })
}

export function useResetManagedUserPassword() {
  return useMutation({
    mutationFn: (uid: string) => apiPost<{ resetLink: string }>('/api/users/reset-link', { uid }),
  })
}
