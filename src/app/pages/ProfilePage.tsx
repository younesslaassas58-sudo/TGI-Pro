import { useRef, useState, type ChangeEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { updateDoc, doc, deleteField } from 'firebase/firestore'
import { Avatar, Button, Card, Input, Label } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth, updateAuthProfile } from '@/features/auth/authStore'
import { useToast } from '@/components/ui'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/types/user'
import { roleLabel } from '@/lib/user'
import { compressProfilePhoto } from '@/lib/compressProfilePhoto'

const profileSchema = z.object({
  displayName: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  civilite: z.enum(['M.', 'Mme', 'Mlle']),
  phone: z.string().trim().max(30, 'Le numéro de téléphone est trop long.'),
})

type ProfileValues = z.infer<typeof profileSchema>

export function ProfilePage() {
  const profile = useAuth((state) => state.profile)
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoURL, setPhotoURL] = useState(profile?.photoURL ?? '')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.displayName ?? '',
      civilite: profile?.civilite ?? 'M.',
      phone: profile?.phone ?? '',
    },
  })

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setPhotoLoading(true)
    try {
      setPhotoURL(await compressProfilePhoto(file))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'La préparation de la photo a échoué.')
    } finally {
      setPhotoLoading(false)
    }
  }

  async function saveProfile(values: ProfileValues) {
    if (!profile) return
    setSaving(true)
    try {
      const changes = {
        displayName: values.displayName.trim(),
        civilite: values.civilite,
        phone: values.phone.trim() || deleteField(),
        photoURL: photoURL || deleteField(),
      }
      await updateDoc(doc(db, 'users', profile.uid), changes)

      const updatedProfile: UserProfile = {
        ...profile,
        displayName: values.displayName.trim(),
        civilite: values.civilite,
      }
      if (values.phone.trim()) updatedProfile.phone = values.phone.trim()
      else delete updatedProfile.phone
      if (photoURL) updatedProfile.photoURL = photoURL
      else delete updatedProfile.photoURL

      updateAuthProfile(updatedProfile)
      toast.success('Votre profil a été mis à jour.')
    } catch {
      toast.error('Impossible de mettre à jour votre profil. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Mon profil" description="Gérez vos informations personnelles." />
      <Card className="max-w-3xl p-5 sm:p-8">
        <form className="space-y-7" onSubmit={handleSubmit(saveProfile)} noValidate>
          <section className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-center">
            <Avatar
              name={profile?.displayName ?? ''}
              src={photoURL || undefined}
              size="lg"
              className="size-20 text-xl"
            />
            <div>
              <h2 className="font-heading text-base font-semibold text-slate-900">Photo de profil</h2>
              <p className="mt-1 text-sm text-slate-500">
                Image carrée, redimensionnée en 256 × 256 et compressée sous 100 Ko.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Choisir une photo de profil"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                loading={photoLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {!photoLoading && <Camera size={16} aria-hidden="true" />}
                Choisir une photo
              </Button>
              {photoURL && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => setPhotoURL('')}
                >
                  Supprimer la photo
                </Button>
              )}
            </div>
          </section>

          <section className="grid gap-5 sm:grid-cols-2" aria-label="Informations personnelles">
            <div>
              <Label htmlFor="civilite">Civilité</Label>
              <select
                id="civilite"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
                {...register('civilite')}
              >
                <option value="M.">M.</option>
                <option value="Mme">Mme</option>
                <option value="Mlle">Mlle</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="displayName" required>
                Nom affiché
              </Label>
              <Input id="displayName" autoComplete="name" {...register('displayName')} />
              {errors.displayName && (
                <p className="mt-1.5 text-xs text-danger-700" role="alert">
                  {errors.displayName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
              {errors.phone && (
                <p className="mt-1.5 text-xs text-danger-700" role="alert">
                  {errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input id="email" type="email" value={profile?.email ?? ''} readOnly />
            </div>
            {profile && (
              <div>
                <Label>Rôle</Label>
                <p className="flex min-h-11 items-center text-sm font-medium text-slate-700">
                  {roleLabel(profile.role)}
                </p>
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <UserRound size={15} aria-hidden="true" />
              Le rôle et le statut du compte ne peuvent pas être modifiés ici.
            </p>
            <Button type="submit" loading={saving}>
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
