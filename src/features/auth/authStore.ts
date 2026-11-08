import {
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { create } from 'zustand'
import { auth, db } from '@/lib/firebase'
import type { UserProfile, UserRole } from '@/types/user'
import { getAuthErrorMessage } from './authErrors'

export type AuthProfileErrorCode =
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_INACTIVE'
  | 'PROFILE_INVALID_ROLE'
  | 'PROFILE_FIRESTORE_ERROR'
  | null

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  errorCode: AuthProfileErrorCode
  signInWithEmail: (email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

function isUserRole(value: unknown): value is UserRole {
  return value === 'directeur' || value === 'commercial' || value === 'technicien'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function firebaseErrorCode(error: unknown): string | null {
  const record = asRecord(error)
  return typeof record?.code === 'string' ? record.code : null
}

let stopAuthListener: (() => void) | undefined
let persistenceReady: Promise<void> | undefined
let loadingUid: string | null = null
let loadedUid: string | null = null
let authGeneration = 0

export const useAuth = create<AuthState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,
  errorCode: null,
  signInWithEmail: async (email, password) => {
    set({ error: null, errorCode: null })
    try {
      await persistenceReady
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: unknown) {
      const message = getAuthErrorMessage(error)
      set({ error: message })
      throw new Error(message, { cause: error })
    }
  },
  sendPasswordReset: async (email) => {
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error: unknown) {
      if (firebaseErrorCode(error) === 'auth/user-not-found') return
      const message = getAuthErrorMessage(error)
      throw new Error(message, { cause: error })
    }
  },
  signOut: async () => {
    await firebaseSignOut(auth)
  },
}))

export function initializeAuthListener(): () => void {
  persistenceReady ??= setPersistence(auth, browserLocalPersistence)
  if (!stopAuthListener) {
    stopAuthListener = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!firebaseUser) {
          authGeneration += 1
          loadingUid = null
          loadedUid = null
          setAuthState({ user: null, profile: null, loading: false })
          return
        }

        if (loadedUid === firebaseUser.uid || loadingUid === firebaseUser.uid) return

        loadingUid = firebaseUser.uid
        const generation = ++authGeneration
        setAuthState({ user: null, profile: null, loading: true, error: null, errorCode: null })

        try {
          await persistenceReady
          const profileSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (
            authGeneration !== generation ||
            auth.currentUser?.uid !== firebaseUser.uid
          ) {
            return
          }

          if (!profileSnapshot.exists()) {
            await rejectProfile(
              firebaseUser,
              'PROFILE_NOT_FOUND',
              `Profil introuvable pour ce compte (UID : ${firebaseUser.uid}). Contactez le directeur.`,
            )
            return
          }

          const data = asRecord(profileSnapshot.data())
          if (data?.active !== true) {
            await rejectProfile(
              firebaseUser,
              'PROFILE_INACTIVE',
              'Votre compte est désactivé. Contactez le directeur.',
            )
            return
          }

          if (!isUserRole(data.role)) {
            await rejectProfile(
              firebaseUser,
              'PROFILE_INVALID_ROLE',
              'Rôle invalide sur votre profil. Contactez le directeur.',
            )
            return
          }

          const profile: UserProfile = {
            uid: firebaseUser.uid,
            email: typeof data.email === 'string' ? data.email : firebaseUser.email ?? '',
            displayName:
              typeof data.displayName === 'string' && data.displayName.trim()
                ? data.displayName
                : firebaseUser.displayName ?? firebaseUser.email ?? '',
            role: data.role,
            active: true,
            ...(typeof data.photoURL === 'string' ? { photoURL: data.photoURL } : {}),
            ...(typeof data.phone === 'string' ? { phone: data.phone } : {}),
          }

          loadedUid = firebaseUser.uid
          setAuthState({ user: firebaseUser, profile, loading: false, error: null, errorCode: null })
        } catch (error: unknown) {
          if (
            authGeneration !== generation ||
            auth.currentUser?.uid !== firebaseUser.uid
          ) {
            return
          }
          const code = firebaseErrorCode(error) ?? 'unknown'
          const internalCode = 'PROFILE_FIRESTORE_ERROR'
          const message = `Impossible de charger votre profil (${code}). Réessayez ou contactez le directeur.`
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            error: message,
            errorCode: internalCode,
          })
          loadedUid = firebaseUser.uid
          try {
            await firebaseSignOut(auth)
          } catch (signOutError: unknown) {
            console.error('Échec de la déconnexion après une erreur de chargement du profil.', signOutError)
          }
          if (!firebaseErrorCode(error)) {
            console.error('Erreur inattendue lors du chargement du profil Firebase.', error)
          }
        } finally {
          if (authGeneration === generation && loadingUid === firebaseUser.uid) {
            loadingUid = null
          }
        }
      },
      (error) => {
        const code = firebaseErrorCode(error) ?? 'unknown'
        console.error('Erreur inattendue dans l’écoute de l’authentification Firebase.', error)
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          error: `Impossible de charger votre profil (${code}). Réessayez ou contactez le directeur.`,
          errorCode: 'PROFILE_FIRESTORE_ERROR',
        })
      },
    )
  }

  return () => {
    stopAuthListener?.()
    stopAuthListener = undefined
  }
}

async function rejectProfile(user: User, errorCode: Exclude<AuthProfileErrorCode, null>, error: string) {
  setAuthState({ user: null, profile: null, loading: false, error, errorCode })
  loadedUid = user.uid
  try {
    await firebaseSignOut(auth)
  } catch (signOutError: unknown) {
    console.error('Échec de la déconnexion après le refus du profil.', signOutError)
  }
}

function setAuthState(
  state: Pick<AuthState, 'user' | 'profile' | 'loading'> &
    Partial<Pick<AuthState, 'error' | 'errorCode'>>,
) {
  useAuth.setState((current) => ({ ...current, ...state }))
}

export function updateAuthProfile(profile: UserProfile): void {
  useAuth.setState({ profile })
}
