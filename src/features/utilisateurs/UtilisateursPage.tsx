import { useMemo, useState, type FormEvent } from 'react'
import { Copy, KeyRound, Plus, Search, UserCog } from 'lucide-react'
import { z } from 'zod'
import { Avatar, Badge, Button, Card, Input, Label, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/features/auth/authStore'
import { roleLabel } from '@/lib/user'
import { useTechniciens } from '@/features/techniciens/useTechniciens'
import { useCreateManagedUser, useManagedUsers, useResetManagedUserPassword, useUpdateManagedUser, type ManagedUser } from './useUsers'
import type { UserRole } from '@/types/user'

const createSchema = z.object({
  displayName: z.string().trim().min(2, 'Saisissez le nom complet (2 caractères minimum).'),
  email: z.string().trim().email('Saisissez une adresse e-mail valide.'),
  password: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères.'),
  civilite: z.enum(['M.', 'Mme', 'Mlle']),
  role: z.enum(['directeur', 'commercial', 'technicien']),
  telephone: z.string().trim().max(30, 'Le numéro de téléphone est trop long.'),
  technicienId: z.string(),
})
const editSchema = createSchema.omit({ email: true, password: true, technicienId: true }).extend({ uid: z.string(), active: z.boolean() })

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

const roles: UserRole[] = ['directeur', 'commercial', 'technicien']

function generateStrongPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-'
  const randomValues = crypto.getRandomValues(new Uint32Array(20))
  const generated = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('')
  return `Tg!${generated}9`
}

async function copyText(value: string, success: string, toast: ReturnType<typeof useToast>) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(success)
  } catch {
    toast.error('Impossible de copier dans le presse-papiers.')
  }
}

function formatLastSignIn(value: string): string {
  if (!value) return 'Non disponible'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Non disponible' : new Intl.DateTimeFormat('fr-MA', { dateStyle: 'medium' }).format(date)
}

export function UtilisateursPage() {
  const { data = [], isLoading, error } = useManagedUsers()
  const { data: technicians = [], isError: techniciansError } = useTechniciens()
  const currentUid = useAuth((state) => state.user?.uid) ?? ''
  const create = useCreateManagedUser()
  const update = useUpdateManagedUser()
  const reset = useResetManagedUserPassword()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | 'password' | null>(null)
  const [selected, setSelected] = useState<ManagedUser>()
  const [createValues, setCreateValues] = useState<CreateValues>({
    displayName: '', email: '', password: '', civilite: 'M.', role: 'commercial', telephone: '', technicienId: '',
  })
  const [editValues, setEditValues] = useState<EditValues>()
  const [formError, setFormError] = useState('')
  const [createdCredentials, setCreatedCredentials] = useState<{ displayName: string; email: string; password: string }>()
  const [resetLink, setResetLink] = useState('')
  const activeDirectors = data.filter((item) => item.active && item.role === 'directeur')
  const filtered = useMemo(() => data.filter((user) =>
    (!roleFilter || user.role === roleFilter)
    && (!statusFilter || String(user.active) === statusFilter)
    && (!query.trim() || `${user.displayName} ${user.email} ${user.phone}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))),
  ).sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr')), [data, query, roleFilter, statusFilter])

  function closeModal() {
    setModal(null)
    setSelected(undefined)
    setFormError('')
    setCreatedCredentials(undefined)
    setResetLink('')
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const parsed = createSchema.safeParse(createValues)
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Vérifiez les informations saisies.')
      return
    }
    try {
      await create.mutateAsync(parsed.data)
      setCreatedCredentials({ displayName: parsed.data.displayName, email: parsed.data.email, password: parsed.data.password })
      setCreateValues({ ...parsed.data, password: '', displayName: parsed.data.displayName })
      toast.success('Le compte utilisateur a été créé.')
    } catch (requestError: unknown) {
      setFormError(requestError instanceof Error ? requestError.message : 'La création du compte a échoué.')
    }
  }

  function beginEdit(user: ManagedUser) {
    setSelected(user)
    setEditValues({ uid: user.uid, displayName: user.displayName, civilite: user.civilite, role: user.role, telephone: user.phone, active: user.active })
    setModal('edit')
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const parsed = editValues ? editSchema.safeParse(editValues) : undefined
    if (!parsed?.success) {
      setFormError(parsed && !parsed.success ? parsed.error.issues[0]?.message ?? 'Vérifiez les informations.' : 'Compte non sélectionné.')
      return
    }
    try {
      await update.mutateAsync(parsed.data)
      toast.success('Le compte utilisateur a été modifié.')
      closeModal()
    } catch (requestError: unknown) {
      setFormError(requestError instanceof Error ? requestError.message : 'La modification du compte a échoué.')
    }
  }

  async function toggleActive(user: ManagedUser) {
    const nextActive = !user.active
    if (!window.confirm(`${nextActive ? 'Réactiver' : 'Désactiver'} le compte de ${user.displayName || user.email} ?`)) return
    try {
      await update.mutateAsync({
        uid: user.uid,
        displayName: user.displayName,
        civilite: user.civilite,
        role: user.role,
        telephone: user.phone,
        active: nextActive,
      })
      toast.success(nextActive ? 'Compte réactivé.' : 'Compte désactivé.')
    } catch (requestError: unknown) {
      toast.error(requestError instanceof Error ? requestError.message : 'Impossible de modifier le statut du compte.')
    }
  }

  async function requestResetLink(user: ManagedUser) {
    setSelected(user)
    setModal('password')
    setResetLink('')
    try {
      const result = await reset.mutateAsync(user.uid)
      setResetLink(result.resetLink)
    } catch (requestError: unknown) {
      toast.error(requestError instanceof Error ? requestError.message : 'Impossible de générer le lien.')
      setModal(null)
    }
  }

  return <>
    <PageHeader title="Gestion des utilisateurs" description="Créez et gérez les comptes et leurs accès." action={<Button onClick={() => { setCreateValues({ displayName: '', email: '', password: '', civilite: 'M.', role: 'commercial', telephone: '', technicienId: '' }); setModal('create') }}><Plus size={16} /> Nouvel utilisateur</Button>} />
    <Card className="mb-5 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="relative sm:col-span-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" aria-label="Rechercher un utilisateur" placeholder="Nom, e-mail ou téléphone…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></label>
        <Select aria-label="Filtrer par rôle" value={roleFilter} onChange={(event) => setRoleFilter(event.currentTarget.value)}><option value="">Tous les rôles</option>{roles.map((role) => <option value={role} key={role}>{roleLabel(role)}</option>)}</Select>
        <Select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option value="">Tous les statuts</option><option value="true">Actifs</option><option value="false">Inactifs</option></Select>
      </div>
    </Card>
    {techniciansError && <p role="alert" className="mb-4 text-sm text-amber-800">Les comptes sont chargés, mais les liens vers les fiches techniciens ne sont pas disponibles.</p>}
    {isLoading ? <Card className="p-8"><Spinner label="Chargement des utilisateurs" /></Card>
      : error ? <Card role="alert" className="p-6 text-sm text-danger-700">Impossible de charger les comptes. Vérifiez que vous êtes directeur actif.</Card>
      : <Card className="overflow-hidden">
        {filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Aucun utilisateur ne correspond à ces critères.</p>
          : <div className="divide-y divide-slate-100">{filtered.map((user) => {
            const linkedTech = technicians.find((tech) => tech.uidCompte === user.uid)
            const cannotEditRole = user.uid === currentUid || (user.active && user.role === 'directeur' && activeDirectors.length <= 1)
            const actionDisabledReason = user.uid === currentUid
              ? 'Vous ne pouvez pas désactiver ou rétrograder votre propre compte.'
              : 'Le dernier directeur actif ne peut pas être rétrogradé ou désactivé.'
            return <div key={user.uid} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={user.displayName || user.email} src={user.photoURL || undefined} size="md" />
                <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{user.displayName || 'Nom non renseigné'}</p><p className="truncate text-sm text-slate-500">{user.email}</p>{linkedTech && <p className="mt-1 truncate text-xs text-slate-500">Fiche liée : {linkedTech.matricule} · {linkedTech.prenom} {linkedTech.nom}</p>}<p className="text-xs text-slate-500">Dernière connexion : {formatLastSignIn(user.lastSignInAt)}</p></div>
                <div className="flex shrink-0 flex-col items-start gap-1"><Badge variant={user.role === 'directeur' ? 'gold' : 'default'}>{roleLabel(user.role)}</Badge><Badge className={user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}>{user.active ? 'Actif' : 'Inactif'}</Badge></div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="outline" size="sm" onClick={() => beginEdit(user)} title={cannotEditRole ? actionDisabledReason : undefined}><UserCog size={14} /> Modifier</Button>
                <span title={cannotEditRole ? actionDisabledReason : undefined}><Button variant="outline" size="sm" disabled={cannotEditRole || update.isPending} onClick={() => void toggleActive(user)}>{user.active ? 'Désactiver' : 'Activer'}</Button></span>
                <Button variant="ghost" size="sm" disabled={reset.isPending} onClick={() => void requestResetLink(user)}><KeyRound size={14} /> Lien de réinitialisation</Button>
              </div>
            </div>
          })}</div>}
      </Card>}

    <Modal open={modal === 'create'} onClose={closeModal} title={createdCredentials ? 'Compte créé' : 'Nouvel utilisateur'}>
      {createdCredentials ? <div className="space-y-4">
        <p className="text-sm text-slate-700">Le compte de <strong>{createdCredentials.displayName}</strong> a été créé. Communiquez ces informations de façon sécurisée ; le mot de passe ne sera plus affiché après fermeture.</p>
        <div className="space-y-2 rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">E-mail</p><p className="break-all text-sm font-medium">{createdCredentials.email}</p><p className="text-xs text-slate-500">Mot de passe temporaire</p><p className="break-all font-mono text-sm">{createdCredentials.password}</p></div>
        <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => copyText(`${createdCredentials.email}\n${createdCredentials.password}`, 'Identifiants copiés.', toast)}><Copy size={15} /> Copier</Button><Button onClick={closeModal}>Fermer</Button></div>
      </div> : <form className="space-y-4" onSubmit={(event) => void submitCreate(event)}>
        <div><Label htmlFor="create-name">Nom complet</Label><Input id="create-name" autoComplete="name" value={createValues.displayName} onChange={(event) => setCreateValues({ ...createValues, displayName: event.currentTarget.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="create-civilite">Civilité</Label><Select id="create-civilite" value={createValues.civilite} onChange={(event) => setCreateValues({ ...createValues, civilite: event.currentTarget.value as CreateValues['civilite'] })}><option>M.</option><option>Mme</option><option>Mlle</option></Select></div><div><Label htmlFor="create-role">Rôle</Label><Select id="create-role" value={createValues.role} onChange={(event) => setCreateValues({ ...createValues, role: event.currentTarget.value as UserRole, technicienId: '' })}><option value="directeur">Directeur</option><option value="commercial">Commercial</option><option value="technicien">Technicien</option></Select></div></div>
        <div><Label htmlFor="create-email">E-mail</Label><Input id="create-email" type="email" autoComplete="email" value={createValues.email} onChange={(event) => setCreateValues({ ...createValues, email: event.currentTarget.value })} /></div>
        <div><Label htmlFor="create-phone">Téléphone (facultatif)</Label><Input id="create-phone" type="tel" value={createValues.telephone} onChange={(event) => setCreateValues({ ...createValues, telephone: event.currentTarget.value })} /></div>
        {createValues.role === 'technicien' && <div><Label htmlFor="create-tech">Fiche technicien à lier</Label><Select id="create-tech" value={createValues.technicienId} onChange={(event) => setCreateValues({ ...createValues, technicienId: event.currentTarget.value })}><option value="">Aucune fiche sélectionnée</option>{technicians.filter((tech) => !tech.uidCompte && !tech.archive && tech.statut === 'actif').map((tech) => <option key={tech.id} value={tech.id}>{tech.prenom} {tech.nom} · {tech.matricule}</option>)}</Select></div>}
        <div><div className="flex items-center justify-between gap-2"><Label htmlFor="create-password">Mot de passe temporaire</Label><Button type="button" size="sm" variant="outline" onClick={() => setCreateValues({ ...createValues, password: generateStrongPassword() })}>Générer un mot de passe fort</Button></div><Input id="create-password" type="text" autoComplete="new-password" value={createValues.password} onChange={(event) => setCreateValues({ ...createValues, password: event.currentTarget.value })} /><p className="mt-1 text-xs text-slate-500">Au moins 10 caractères. Il sera affiché une seule fois après création.</p></div>
        {formError && <p role="alert" className="text-sm text-danger-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" loading={create.isPending}>Créer le compte</Button></div>
      </form>}
    </Modal>

    <Modal open={modal === 'edit'} onClose={closeModal} title={`Modifier ${selected?.displayName || 'le compte'}`}>
      {editValues && <form className="space-y-4" onSubmit={(event) => void submitEdit(event)}>
        <div><Label htmlFor="edit-name">Nom complet</Label><Input id="edit-name" value={editValues.displayName} onChange={(event) => setEditValues({ ...editValues, displayName: event.currentTarget.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="edit-civilite">Civilité</Label><Select id="edit-civilite" value={editValues.civilite} onChange={(event) => setEditValues({ ...editValues, civilite: event.currentTarget.value as EditValues['civilite'] })}><option>M.</option><option>Mme</option><option>Mlle</option></Select></div><div><Label htmlFor="edit-role">Rôle</Label><Select id="edit-role" disabled={Boolean(selected && (selected.uid === currentUid || (selected.active && selected.role === 'directeur' && activeDirectors.length <= 1)))} title={selected && (selected.uid === currentUid || (selected.active && selected.role === 'directeur' && activeDirectors.length <= 1)) ? 'Vous ne pouvez pas rétrograder le dernier directeur actif ni votre propre compte.' : undefined} value={editValues.role} onChange={(event) => setEditValues({ ...editValues, role: event.currentTarget.value as UserRole })}><option value="directeur">Directeur</option><option value="commercial">Commercial</option><option value="technicien">Technicien</option></Select></div></div>
        <div><Label htmlFor="edit-phone">Téléphone</Label><Input id="edit-phone" type="tel" value={editValues.telephone} onChange={(event) => setEditValues({ ...editValues, telephone: event.currentTarget.value })} /></div>
        {formError && <p role="alert" className="text-sm text-danger-700">{formError}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={closeModal}>Annuler</Button><Button type="submit" loading={update.isPending}>Enregistrer</Button></div>
      </form>}
    </Modal>

    <Modal open={modal === 'password'} onClose={closeModal} title="Lien de réinitialisation">
      {reset.isPending ? <Spinner label="Génération du lien sécurisé" /> : resetLink ? <div className="space-y-4"><p className="text-sm text-slate-700">Transmettez ce lien à <strong>{selected?.email}</strong> de façon sécurisée. Il n’a pas été envoyé par e-mail.</p><Input readOnly value={resetLink} aria-label="Lien de réinitialisation" /><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => copyText(resetLink, 'Lien copié.', toast)}><Copy size={15} /> Copier le lien</Button><Button onClick={closeModal}>Fermer</Button></div></div> : <p className="text-sm text-danger-700">Impossible de générer le lien.</p>}
    </Modal>
  </>
}
