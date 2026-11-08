import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function respondError(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ ok: false, error })
}

function adminApp() {
  const existing = getApps()[0]
  if (existing) return existing
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  if (!encoded) throw new Error('La variable serveur FIREBASE_SERVICE_ACCOUNT_BASE64 est manquante.')
  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid service account object.')
    const value = parsed as Record<string, unknown>
    serviceAccount = {
      project_id: typeof value.project_id === 'string' ? value.project_id : undefined,
      client_email: typeof value.client_email === 'string' ? value.client_email : undefined,
      private_key: typeof value.private_key === 'string' ? value.private_key : undefined,
    }
  } catch {
    throw new Error('La variable FIREBASE_SERVICE_ACCOUNT_BASE64 ne contient pas un compte de service JSON valide.')
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Le compte de service Firebase est incomplet (project_id, client_email, private_key requis).')
  }
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  })
}

export function getAdminAuth() {
  return getAuth(adminApp())
}

export function getAdminDb() {
  return getFirestore(adminApp())
}

export async function requireDirecteur(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const authorization = req.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!token) {
    respondError(res, 401, 'Authentification requise.')
    return null
  }
  let auth: ReturnType<typeof getAuth>
  let db: ReturnType<typeof getFirestore>
  try {
    auth = getAdminAuth()
    db = getAdminDb()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Configuration Firebase Admin invalide.'
    respondError(res, 500, message)
    return null
  }
  let uid: string
  try {
    uid = (await auth.verifyIdToken(token, true)).uid
  } catch {
    respondError(res, 401, 'Jeton d’authentification invalide ou expiré.')
    return null
  }
  try {
    const profile = await db.collection('users').doc(uid).get()
    const data = profile.data()
    if (!profile.exists || data?.active !== true) {
      respondError(res, 403, 'Compte absent ou désactivé.')
      return null
    }
    if (data.role !== 'directeur') {
      respondError(res, 403, 'Cette action est réservée au directeur.')
      return null
    }
    return uid
  } catch {
    respondError(res, 500, 'Impossible de vérifier le profil directeur. Réessayez.')
    return null
  }
}

export function methodNotAllowed(res: VercelResponse): void {
  res.setHeader('Allow', 'POST')
  respondError(res, 405, 'Méthode non autorisée.')
}

export function bodyTooLarge(req: VercelRequest, res: VercelResponse): boolean {
  const contentLength = Number(req.headers['content-length'] ?? 0)
  let bodyLength: number
  try {
    bodyLength = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? ''))
  } catch {
    respondError(res, 400, 'Corps de requête JSON invalide.')
    return true
  }
  if (contentLength > 32_000 || bodyLength > 32_000) {
    respondError(res, 413, 'La requête dépasse la taille maximale autorisée.')
    return true
  }
  return false
}

export function parseBody(req: VercelRequest): unknown {
  if (typeof req.body !== 'string') return req.body
  try {
    return JSON.parse(req.body) as unknown
  } catch {
    return null
  }
}

export function internalError(res: VercelResponse): void {
  respondError(res, 500, 'Une erreur serveur est survenue. Réessayez ou contactez le support.')
}
