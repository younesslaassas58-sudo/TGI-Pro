import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/features/auth/authStore'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { articleSchema, type Article, type ArticleInput } from './types'

const articlesKey = ['articles']

async function loadArticles(): Promise<Article[]> {
  const snapshot = await getDocs(collection(db, 'articles'))
  return snapshot.docs.map((item) => articleSchema.parse({ ...item.data(), id: item.id }))
}

export function useCatalogue(enabled = true) {
  return useQuery({ queryKey: articlesKey, queryFn: loadArticles, enabled })
}

export function useArticle(id: string | undefined) {
  const query = useCatalogue()
  return { ...query, data: query.data?.find((article) => article.id === id) }
}

export function useSaveArticle() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ input, existing }: { input: ArticleInput; existing?: Article }) => {
      const now = new Date().toISOString()
      if (existing) {
        await updateDoc(doc(db, 'articles', existing.id), { ...input, updatedAt: now, updatedBy: uid })
        return existing.id
      }
      const created = doc(collection(db, 'articles'))
      const code = await getNextNumber('article')
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesKey }),
  })
}

export function useArchiveArticle() {
  const queryClient = useQueryClient()
  const uid = useAuth((state) => state.user?.uid) ?? ''
  return useMutation({
    mutationFn: async ({ article, archive }: { article: Article; archive: boolean }) => {
      await updateDoc(doc(db, 'articles', article.id), {
        archive,
        updatedAt: new Date().toISOString(),
        updatedBy: uid,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesKey }),
  })
}

export function useDeleteArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => deleteDoc(doc(db, 'articles', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: articlesKey }),
  })
}
