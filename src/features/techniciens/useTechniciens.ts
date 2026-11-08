import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/authStore'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { technicianPrivateSchema, technicianSchema, type Technician, type TechnicianInput, type TechnicianPrivate } from './types'

const techniciansKey = ['techniciens']
const privateKey = ['techniciens-prives']

async function loadTechnicians(uid: string, role: string | undefined): Promise<Technician[]> {
  const ref = collection(db, 'techniciens')
  const snapshot = role === 'technicien'
    ? await getDocs(query(ref, where('uidCompte', '==', uid)))
    : await getDocs(ref)
  return snapshot.docs.map((item) => technicianSchema.parse({ ...item.data(), id: item.id }))
}

export function useTechniciens() {
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const role = useAuth((state) => state.profile?.role)
  return useQuery({
    queryKey: [...techniciansKey, role, uid],
    queryFn: () => loadTechnicians(uid, role),
    enabled: Boolean(uid && role),
  })
}

export function useTechnicienPrive(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...privateKey, id],
    enabled: Boolean(id && enabled),
    queryFn: async (): Promise<TechnicianPrivate> => {
      if (!id) throw new Error('Technicien non sélectionné.')
      const snapshot = await getDoc(doc(db, 'techniciens_prives', id))
      return snapshot.exists()
        ? technicianPrivateSchema.parse(snapshot.data())
        : technicianPrivateSchema.parse({
            cin: '',
            dateNaissance: '',
            adresse: '',
            dateEmbauche: '',
            typeContrat: '',
            personneUrgenceNom: '',
            personneUrgenceTelephone: '',
            notesRH: '',
          })
    },
  })
}

export function useTechnicianUsers(enabled: boolean, currentUid?: string) {
  return useQuery({
    queryKey: ['technician-linked-users', currentUid],
    enabled,
    queryFn: async () => {
      const [snapshot, technicianSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'techniciens')),
      ])
      const linkedUids = new Set(technicianSnapshot.docs
        .map((item) => item.data().uidCompte)
        .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0))
      return snapshot.docs.flatMap((item) => {
        const data = item.data()
        if (data.role !== 'technicien' || (linkedUids.has(item.id) && item.id !== currentUid)) return []
        return [{
          uid: item.id,
          displayName: typeof data.displayName === 'string' ? data.displayName : '',
          email: typeof data.email === 'string' ? data.email : '',
        }]
      })
    },
  })
}

export function useSaveTechnicien() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing, privateData }: {
      input: TechnicianInput
      existing?: Technician
      privateData?: TechnicianPrivate
    }) => {
      const now = new Date().toISOString()
      if (existing) {
        const batch = writeBatch(db)
        batch.update(doc(db, 'techniciens', existing.id), { ...input, updatedAt: now, updatedBy: uid })
        if (privateData) batch.set(doc(db, 'techniciens_prives', existing.id), privateData)
        await batch.commit()
        return existing.id
      }

      const matricule = await getNextNumber('technicien')
      const recordRef = doc(collection(db, 'techniciens'))
      const record = {
        ...input,
        id: recordRef.id,
        matricule,
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        updatedBy: uid,
      }
      const batch = writeBatch(db)
      batch.set(recordRef, record)
      if (privateData) batch.set(doc(db, 'techniciens_prives', recordRef.id), privateData)
      await batch.commit()
      return recordRef.id
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: techniciansKey }),
        queryClient.invalidateQueries({ queryKey: privateKey }),
      ])
    },
  })
}

export function useArchiveTechnicien() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: ({ technician, archive }: { technician: Technician; archive: boolean }) =>
      updateDoc(doc(db, 'techniciens', technician.id), {
        archive,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: techniciansKey }),
  })
}

export function useDeleteTechnicien() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'techniciens', id))
      batch.delete(doc(db, 'techniciens_prives', id))
      await batch.commit()
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: techniciansKey }),
        queryClient.invalidateQueries({ queryKey: privateKey }),
      ])
    },
  })
}
