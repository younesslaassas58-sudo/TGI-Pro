import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FieldValue } from 'firebase-admin/firestore'
import { getAdminAuth, getAdminDb, bodyTooLarge, internalError, methodNotAllowed, parseBody, requireDirecteur } from '../_lib/admin.js'

const updateSchema = z.object({
  uid: z.string().min(1).max(128),
  displayName: z.string().trim().min(2).max(100),
  civilite: z.enum(['M.', 'Mme', 'Mlle']),
  role: z.enum(['directeur', 'commercial', 'technicien']),
  telephone: z.string().trim().max(30),
  active: z.boolean(),
}).strict()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  if (bodyTooLarge(req, res)) return
  const directorUid = await requireDirecteur(req, res)
  if (!directorUid) return
  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  const parsed = updateSchema.safeParse(parseBody(req))
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides.' })
  const input = parsed.data
  if (input.uid === directorUid && (input.active === false || input.role !== 'directeur')) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez pas désactiver ou rétrograder votre propre compte directeur.' })
  }

  const userRef = adminDb.collection('users').doc(input.uid)
  const oldProfile = await userRef.get()
  if (!oldProfile.exists) return res.status(404).json({ ok: false, error: 'Compte utilisateur introuvable.' })
  const oldData = oldProfile.data()
  if (!oldData) return res.status(404).json({ ok: false, error: 'Profil utilisateur introuvable.' })

  try {
    await adminDb.runTransaction(async (transaction) => {
      const freshTarget = await transaction.get(userRef)
      const current = freshTarget.data()
      if (!freshTarget.exists || !current) throw new Error('USER_NOT_FOUND')
      const removesDirector = current.role === 'directeur' && current.active === true
        && (input.role !== 'directeur' || input.active !== true)
      if (removesDirector) {
        const directors = await transaction.get(
          adminDb.collection('users').where('role', '==', 'directeur'),
        )
        if (directors.docs.filter((director) => director.data().active === true).length <= 1) {
          throw new Error('LAST_DIRECTOR')
        }
      }
      if (current.role === 'technicien' && input.role !== 'technicien') {
        const linkedTechnicians = await transaction.get(
          adminDb.collection('techniciens').where('uidCompte', '==', input.uid),
        )
        for (const technician of linkedTechnicians.docs) {
          transaction.update(technician.ref, {
            uidCompte: '',
            updatedAt: new Date().toISOString(),
            updatedBy: directorUid,
          })
        }
      }
      transaction.update(userRef, {
        displayName: input.displayName,
        civilite: input.civilite,
        role: input.role,
        phone: input.telephone,
        active: input.active,
        updatedAt: new Date().toISOString(),
        updatedBy: directorUid,
      })
    })

    await adminAuth.updateUser(input.uid, { displayName: input.displayName, disabled: !input.active })
    if (!input.active) await adminAuth.revokeRefreshTokens(input.uid)
    return res.status(200).json({ ok: true, data: { uid: input.uid } })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'LAST_DIRECTOR') {
      return res.status(409).json({ ok: false, error: 'Impossible de rétrograder ou désactiver le dernier directeur actif.' })
    }
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ ok: false, error: 'Compte utilisateur introuvable.' })
    }
    try {
      await userRef.update({
        displayName: oldData.displayName ?? '',
        civilite: oldData.civilite ?? 'M.',
        role: oldData.role,
        phone: oldData.phone ?? '',
        active: oldData.active === true,
        updatedAt: FieldValue.serverTimestamp(),
      })
      await adminAuth.updateUser(input.uid, { displayName: typeof oldData.displayName === 'string' ? oldData.displayName : undefined, disabled: oldData.active !== true })
    } catch {
      return res.status(500).json({ ok: false, error: 'La modification a échoué et le profil nécessite une vérification par le directeur.' })
    }
    internalError(res)
  }
}
