import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAdminAuth, getAdminDb, bodyTooLarge, internalError, methodNotAllowed, parseBody, requireDirecteur } from '../_lib/admin.js'

const resetSchema = z.object({ uid: z.string().min(1).max(128) }).strict()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res)
  if (bodyTooLarge(req, res)) return
  if (!await requireDirecteur(req, res)) return
  const adminAuth = getAdminAuth()
  const adminDb = getAdminDb()
  const parsed = resetSchema.safeParse(parseBody(req))
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'Identifiant utilisateur invalide.' })
  try {
    const profile = await adminDb.collection('users').doc(parsed.data.uid).get()
    const email = profile.data()?.email
    if (!profile.exists || typeof email !== 'string' || !email) {
      return res.status(404).json({ ok: false, error: 'Compte utilisateur ou adresse e-mail introuvable.' })
    }
    const resetLink = await adminAuth.generatePasswordResetLink(email)
    return res.status(200).json({ ok: true, data: { resetLink } })
  } catch {
    internalError(res)
  }
}
