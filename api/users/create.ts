import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAdminAuth, getAdminDb, bodyTooLarge, internalError, methodNotAllowed, parseBody, requireDirecteur } from '../_lib/admin.js'

const createSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide.').max(254),
  password: z.string().min(10, 'Le mot de passe temporaire doit contenir au moins 10 caractères.').max(128),
  displayName: z.string().trim().min(2, 'Le nom complet doit contenir au moins 2 caractères.').max(100),
  civilite: z.enum(['M.', 'Mme', 'Mlle']),
  role: z.enum(['directeur', 'commercial', 'technicien']),
  telephone: z.string().trim().max(30).optional().default(''),
  technicienId: z.string().trim().max(128).optional().default(''),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  if (bodyTooLarge(req, res)) return
  const directorUid = await requireDirecteur(req, res)
  if (!directorUid) return
  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  const parsed = createSchema.safeParse(parseBody(req))
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides.' })
  const input = parsed.data
  if (input.role !== 'technicien' && input.technicienId) {
    return res.status(400).json({ ok: false, error: 'Seul un compte technicien peut être lié à une fiche technicien.' })
  }

  let createdUid: string | undefined
  let profileWritten = false
  try {
    if (input.technicienId) {
      const technician = await adminDb.collection('techniciens').doc(input.technicienId).get()
      if (!technician.exists) return res.status(404).json({ ok: false, error: 'Fiche technicien introuvable.' })
      if (technician.data()?.uidCompte) return res.status(409).json({ ok: false, error: 'Cette fiche est déjà liée à un compte utilisateur.' })
    }

    const authUser = await adminAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      disabled: false,
    })
    createdUid = authUser.uid
    const userRef = adminDb.collection('users').doc(authUser.uid)
    await adminDb.runTransaction(async (transaction) => {
      const technicianRef = input.technicienId
        ? adminDb.collection('techniciens').doc(input.technicienId)
        : undefined
      const technician = technicianRef ? await transaction.get(technicianRef) : undefined
      if (technicianRef && !technician?.exists) throw new Error('TECHNICIAN_NOT_FOUND')
      if (technician?.data()?.uidCompte) throw new Error('TECHNICIAN_ALREADY_LINKED')
      transaction.set(userRef, {
        uid: authUser.uid,
        displayName: input.displayName,
        email: input.email,
        role: input.role,
        active: true,
        civilite: input.civilite,
        phone: input.telephone,
        createdAt: new Date().toISOString(),
      })
      if (technicianRef) {
        transaction.update(technicianRef, {
          uidCompte: authUser.uid,
          updatedAt: new Date().toISOString(),
          updatedBy: directorUid,
        })
      }
    })
    profileWritten = true
    return res.status(201).json({ ok: true, data: { uid: authUser.uid, displayName: input.displayName, email: input.email, role: input.role } })
  } catch (error: unknown) {
    if (createdUid) {
      try {
        if (profileWritten) await adminDb.collection('users').doc(createdUid).delete()
        await adminAuth.deleteUser(createdUid)
      } catch {
        return res.status(500).json({ ok: false, error: 'La création a échoué et le nettoyage du compte incomplet a nécessité une intervention du directeur.' })
      }
      if (error instanceof Error && error.message === 'TECHNICIAN_NOT_FOUND') {
        return res.status(404).json({ ok: false, error: 'Fiche technicien introuvable.' })
      }
      if (error instanceof Error && error.message === 'TECHNICIAN_ALREADY_LINKED') {
        return res.status(409).json({ ok: false, error: 'Cette fiche est déjà liée à un compte utilisateur.' })
      }
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = error.code
      if (code === 'auth/email-already-exists') return res.status(409).json({ ok: false, error: 'Cette adresse e-mail est déjà utilisée.' })
      if (code === 'auth/invalid-password') return res.status(400).json({ ok: false, error: 'Le mot de passe temporaire ne respecte pas les exigences de sécurité Firebase.' })
      if (code === 'auth/invalid-email') return res.status(400).json({ ok: false, error: 'Adresse e-mail invalide.' })
    }
    internalError(res)
  }
}
