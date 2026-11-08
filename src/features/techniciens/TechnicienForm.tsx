import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Avatar, Button, Input, Label, Select, Textarea, useToast } from '@/components/ui'
import { compressProfilePhoto } from '@/lib/compressProfilePhoto'
import { useAuth } from '@/features/auth/authStore'
import { technicianSchema, specialties, specialtyLabels, type Technician, type TechnicianInput, type TechnicianPrivate } from './types'
import { useTechnicienPrive, useTechnicianUsers } from './useTechniciens'

const inputSchema = technicianSchema.omit({
  id: true,
  matricule: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
})

interface TechnicianFormProps {
  initial?: Technician
  director: boolean
  busy: boolean
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSave: (input: TechnicianInput, privateData?: TechnicianPrivate) => void
}

export function TechnicianForm({ initial, director, busy, onCancel, onDirtyChange, onSave }: TechnicianFormProps) {
  const isDirector = useAuth((state) => state.profile?.role === 'directeur')
  const privateQuery = useTechnicienPrive(initial?.id, isDirector)
  const usersQuery = useTechnicianUsers(director, initial?.uidCompte)
  const toast = useToast()
  const photoInput = useRef<HTMLInputElement>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [privateEdits, setPrivateEdits] = useState<Partial<TechnicianPrivate>>({})
  const { register, control, handleSubmit, setValue, formState: { errors, isDirty } } = useForm<TechnicianInput>({
    resolver: zodResolver(inputSchema),
    defaultValues: initial ? {
      nom: initial.nom,
      prenom: initial.prenom,
      photoURL: initial.photoURL,
      telephone: initial.telephone,
      email: initial.email,
      poste: initial.poste,
      specialites: initial.specialites,
      zoneIntervention: initial.zoneIntervention,
      statut: initial.statut,
      disponibilite: initial.disponibilite,
      habilitations: initial.habilitations,
      vehicule: initial.vehicule,
      uidCompte: initial.uidCompte,
      archive: initial.archive,
    } : {
      nom: '', prenom: '', photoURL: '', telephone: '', email: '', poste: '',
      specialites: [], zoneIntervention: '', statut: 'actif', disponibilite: '',
      habilitations: [], vehicule: '', uidCompte: '', archive: false,
    },
  })
  const certificates = useFieldArray({ control, name: 'habilitations' })
  const photoURL = useWatch({ control, name: 'photoURL' })
  const selectedSpecialties = useWatch({ control, name: 'specialites' })
  const firstName = useWatch({ control, name: 'prenom' })
  const lastName = useWatch({ control, name: 'nom' })
  const dirty = isDirty || Object.keys(privateEdits).length > 0

  const privateFields: TechnicianPrivate = {
    cin: '', dateNaissance: '', adresse: '', dateEmbauche: '', typeContrat: '',
    personneUrgenceNom: '', personneUrgenceTelephone: '', notesRH: '',
    ...privateQuery.data,
    ...privateEdits,
  }

  function updatePrivate<K extends keyof TechnicianPrivate>(key: K, value: TechnicianPrivate[K]) {
    setPrivateEdits((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  async function changePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setPhotoLoading(true)
    try {
      setValue('photoURL', await compressProfilePhoto(file), { shouldDirty: true })
      toast.success('La photo du technicien est prête.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'La préparation de la photo a échoué.')
    } finally {
      setPhotoLoading(false)
    }
  }

  function submit(input: TechnicianInput) {
    if (director && privateQuery.isLoading) {
      toast.error('Attendez le chargement des informations RH avant l’enregistrement.')
      return
    }
    if (director && !window.confirm('Enregistrer les modifications de cette fiche technicien ?')) return
    onSave(input, director ? privateFields : undefined)
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(submit)(event)}>
      <section className="space-y-4">
        <h3 className="font-heading font-semibold text-navy-900">Identité et photo</h3>
        <div className="flex items-center gap-4">
          <Avatar name={`${firstName} ${lastName}`} src={photoURL || undefined} size="lg" />
          <div className="flex flex-wrap gap-2">
            <input ref={photoInput} type="file" accept="image/*" className="sr-only" onChange={(event) => void changePhoto(event)} />
            <Button type="button" variant="outline" loading={photoLoading} onClick={() => photoInput.current?.click()}><Upload size={15} /> Ajouter une photo</Button>
            {photoURL && <Button type="button" variant="ghost" onClick={() => setValue('photoURL', '', { shouldDirty: true })}>Retirer</Button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="prenom">Prénom</Label><Input id="prenom" {...register('prenom')} />{errors.prenom && <p className="mt-1 text-xs text-danger-700">{errors.prenom.message}</p>}</div>
          <div><Label htmlFor="nom">Nom</Label><Input id="nom" {...register('nom')} />{errors.nom && <p className="mt-1 text-xs text-danger-700">{errors.nom.message}</p>}</div>
          <div><Label htmlFor="telephone">Téléphone</Label><Input id="telephone" type="tel" {...register('telephone')} /></div>
          <div><Label htmlFor="email">E-mail professionnel</Label><Input id="email" type="email" {...register('email')} />{errors.email && <p className="mt-1 text-xs text-danger-700">{errors.email.message}</p>}</div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-heading font-semibold text-navy-900">Informations professionnelles</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="poste">Poste</Label><Input id="poste" {...register('poste')} /></div>
          <div><Label htmlFor="zoneIntervention">Zone d’intervention</Label><Input id="zoneIntervention" {...register('zoneIntervention')} /></div>
          <div><Label htmlFor="statut">Statut</Label><Select id="statut" {...register('statut')}><option value="actif">Actif</option><option value="conge">En congé</option><option value="inactif">Inactif</option></Select></div>
          <div><Label htmlFor="disponibilite">Disponibilité</Label><Input id="disponibilite" {...register('disponibilite')} placeholder="Ex. Lun–Ven, 8 h–17 h" /></div>
          <div><Label htmlFor="vehicule">Véhicule</Label><Input id="vehicule" {...register('vehicule')} /></div>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Spécialités</legend>
          <div className="flex flex-wrap gap-2">
            {specialties.map((specialty) => {
              const checked = selectedSpecialties.includes(specialty)
              return <label key={specialty} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={checked} onChange={(event) => {
                  const next = event.currentTarget.checked
                    ? [...selectedSpecialties, specialty]
                    : selectedSpecialties.filter((item) => item !== specialty)
                  setValue('specialites', next, { shouldDirty: true, shouldValidate: true })
                }} />
                {specialtyLabels[specialty]}
              </label>
            })}
          </div>
          {errors.specialites && <p className="mt-1 text-xs text-danger-700">{errors.specialites.message}</p>}
        </fieldset>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-heading font-semibold text-navy-900">Habilitations et certifications</h3><Button type="button" variant="outline" size="sm" onClick={() => certificates.append({ intitule: '', organisme: '', dateObtention: '', dateExpiration: '' })}><Plus size={15} /> Ajouter</Button></div>
        {certificates.fields.map((field, index) => <div key={field.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
          <div><Label htmlFor={`cert-${index}-title`}>Intitulé</Label><Input id={`cert-${index}-title`} {...register(`habilitations.${index}.intitule`)} /></div>
          <div><Label htmlFor={`cert-${index}-org`}>Organisme</Label><Input id={`cert-${index}-org`} {...register(`habilitations.${index}.organisme`)} /></div>
          <div><Label htmlFor={`cert-${index}-start`}>Date d’obtention</Label><Input id={`cert-${index}-start`} type="date" {...register(`habilitations.${index}.dateObtention`)} /></div>
          <div className="flex items-end gap-2"><div className="flex-1"><Label htmlFor={`cert-${index}-end`}>Date d’expiration</Label><Input id={`cert-${index}-end`} type="date" {...register(`habilitations.${index}.dateExpiration`)} /></div><Button type="button" variant="ghost" aria-label="Supprimer l’habilitation" onClick={() => certificates.remove(index)}><Trash2 size={16} /></Button></div>
        </div>)}
      </section>

      {director && <section className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <h3 className="font-heading font-semibold text-navy-900">Données personnelles RH — accès directeur</h3>
        {privateQuery.isError && <p role="alert" className="text-sm text-danger-700">Impossible de charger les informations RH. Aucun changement RH ne sera enregistré.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">CIN<Input value={privateFields.cin} onChange={(event) => updatePrivate('cin', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Date de naissance<Input type="date" value={privateFields.dateNaissance} onChange={(event) => updatePrivate('dateNaissance', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Adresse<Input value={privateFields.adresse} onChange={(event) => updatePrivate('adresse', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Date d’embauche<Input type="date" value={privateFields.dateEmbauche} onChange={(event) => updatePrivate('dateEmbauche', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Type de contrat<Input value={privateFields.typeContrat} onChange={(event) => updatePrivate('typeContrat', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Personne à prévenir<Input value={privateFields.personneUrgenceNom} onChange={(event) => updatePrivate('personneUrgenceNom', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700">Téléphone d’urgence<Input type="tel" value={privateFields.personneUrgenceTelephone} onChange={(event) => updatePrivate('personneUrgenceTelephone', event.currentTarget.value)} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes RH<Textarea value={privateFields.notesRH} onChange={(event) => updatePrivate('notesRH', event.currentTarget.value)} rows={3} /></label>
        </div>
        <div>
          <Label htmlFor="linked-user">Compte technicien lié</Label>
          {usersQuery.isError && <p role="alert" className="mb-1 text-xs text-danger-700">Impossible de charger les comptes techniciens. Le lien existant est conservé.</p>}
          <Select id="linked-user" disabled={usersQuery.isLoading || usersQuery.isError} {...register('uidCompte')}><option value="">Aucun compte lié</option>{usersQuery.data?.map((user) => <option value={user.uid} key={user.uid}>{user.displayName || user.email || user.uid}</option>)}</Select>
        </div>
      </section>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="ghost" onClick={() => {
          if (!dirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')) onCancel()
        }}>Annuler</Button>
        <Button type="submit" loading={busy} disabled={Boolean(director && privateQuery.isError)}>{initial ? 'Enregistrer les modifications' : 'Créer le technicien'}</Button>
      </div>
    </form>
  )
}
