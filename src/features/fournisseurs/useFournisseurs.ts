import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/authStore'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { fournisseurSchema, type Fournisseur, type FournisseurInput } from './types'

const fournisseursKey = ['fournisseurs']

async function loadFournisseurs(): Promise<Fournisseur[]> {
  const snapshot = await getDocs(collection(db, 'fournisseurs'))
  return snapshot.docs.map((item) => fournisseurSchema.parse({ ...item.data(), id: item.id }))
}

export function useFournisseurs(enabled = true) {
  return useQuery({ queryKey: fournisseursKey, queryFn: loadFournisseurs, enabled })
}

export function useFournisseur(id: string | undefined) {
  const query = useFournisseurs()
  return { ...query, data: query.data?.find((fournisseur) => fournisseur.id === id) }
}

export function useSaveFournisseur() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing }: { input: FournisseurInput; existing?: Fournisseur }) => {
      const now = new Date().toISOString()
      if (existing) {
        await updateDoc(doc(db, 'fournisseurs', existing.id), { ...input, updatedAt: now, updatedBy: uid })
        return existing.id
      }
      const created = doc(collection(db, 'fournisseurs'))
      const code = await getNextNumber('fournisseur')
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fournisseursKey }),
  })
}

export function useArchiveFournisseur() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ fournisseur, archive }: { fournisseur: Fournisseur; archive: boolean }) => {
      await updateDoc(doc(db, 'fournisseurs', fournisseur.id), {
        archive,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fournisseursKey }),
  })
}

export function useDeleteFournisseur() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, 'fournisseurs', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fournisseursKey }),
  })
}
