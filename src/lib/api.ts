import { auth } from '@/lib/firebase'

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Vous devez être connecté pour effectuer cette action.')
  const token = await user.getIdToken()
  let response: Response
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    if (import.meta.env.DEV) {
      throw new Error('Les fonctions serveur ne sont pas disponibles. Lancez l’application avec : vercel dev')
    }
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion.')
  }

  let result: ApiResponse<T>
  try {
    result = await response.json() as ApiResponse<T>
  } catch {
    if (import.meta.env.DEV) {
      throw new Error('Les fonctions serveur ne sont pas disponibles. Lancez l’application avec : vercel dev')
    }
    throw new Error('Le serveur a renvoyé une réponse invalide.')
  }
  if (!response.ok || result.ok !== true || result.data === undefined) {
    throw new Error(result.error || 'La demande a échoué. Vérifiez vos droits et réessayez.')
  }
  return result.data
}
