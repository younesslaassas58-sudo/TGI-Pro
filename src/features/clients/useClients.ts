import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { useAuth } from '@/features/auth/authStore'
import { clientSchema, type Client, type ClientInput } from './types'

const clientsKey = ['clients']

async function loadClients(): Promise<Client[]> {
  const snapshot = await getDocs(collection(db, 'clients'))
  return snapshot.docs.map((item) => clientSchema.parse({ ...item.data(), id: item.id }))
}

export function useClients() {
  return useQuery({ queryKey: clientsKey, queryFn: loadClients })
}

export interface CommercialOption {
  uid: string
  displayName: string
}

export function useCommercials() {
  return useQuery({
    queryKey: ['client-commercials'],
    queryFn: async (): Promise<CommercialOption[]> => {
      const snapshot = await getDocs(collection(db, 'users'))
      return snapshot.docs.flatMap((item) => {
        const data = item.data()
        if (data.role !== 'commercial' || data.active !== true) return []
        return [{
          uid: item.id,
          displayName: typeof data.displayName === 'string' && data.displayName.trim()
            ? data.displayName
            : typeof data.email === 'string' ? data.email : item.id,
        }]
      })
    },
  })
}

export function useClient(id: string | undefined) {
  const query = useClients()
  return {
    ...query,
    data: query.data?.find((client) => client.id === id),
  }
}

export function useSaveClient() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing }: { input: ClientInput; existing?: Client }) => {
      const now = new Date().toISOString()
      if (existing) {
        await updateDoc(doc(db, 'clients', existing.id), { ...input, updatedAt: now, updatedBy: uid })
        return existing.id
      }
      const code = await getNextNumber('client')
      const record = {
        ...input,
        code,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      }
      const created = doc(collection(db, 'clients'))
      await setDoc(created, { ...record, id: created.id })
      return created.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientsKey }),
  })
}

export function useArchiveClient() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ client, archive }: { client: Client; archive: boolean }) => {
      await updateDoc(doc(db, 'clients', client.id), {
        archive,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientsKey }),
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const elevators = await getDocs(collection(db, 'ascenseurs'))
      if (elevators.docs.some((item) => item.data().clientId === id)) {
        throw new Error('Ce client possède des appareils. Archivez-le plutôt que de le supprimer.')
      }
      await deleteDoc(doc(db, 'clients', id))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientsKey }),
  })
}
