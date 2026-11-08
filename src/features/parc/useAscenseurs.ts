import { useMutation, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/firebase'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { useAuth } from '@/features/auth/authStore'
import { ascenseurSchema, type Ascenseur, type AscenseurInput } from './types'

const key = ['ascenseurs']

async function loadAscenseurs(): Promise<Ascenseur[]> {
  const snapshot = await getDocs(collection(db, 'ascenseurs'))
  return snapshot.docs.map((item) => ascenseurSchema.parse({ ...item.data(), id: item.id }))
}

export function useAscenseurs(clientId?: string) {
  const query = useQuery({ queryKey: key, queryFn: loadAscenseurs })
  return {
    ...query,
    data: query.data?.filter((item) => !clientId || item.clientId === clientId),
  }
}

export function useAscenseur(id: string | undefined) {
  const query = useAscenseurs()
  return { ...query, data: query.data?.find((item) => item.id === id) }
}

export function useSaveAscenseur() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing }: { input: AscenseurInput; existing?: Ascenseur }) => {
      const now = new Date().toISOString()
      if (existing) {
        await updateDoc(doc(db, 'ascenseurs', existing.id), {
          ...input,
          updatedAt: now,
          updatedBy: uid,
        })
        return existing.id
      }
      const code = await getNextNumber('ascenseur')
      const created = doc(collection(db, 'ascenseurs'))
      await setDoc(created, {
        ...input,
        id: created.id,
        code,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      })
      return created.id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteAscenseur() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, 'ascenseurs', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
