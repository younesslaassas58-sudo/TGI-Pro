import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Button, Input, Label, Select, Textarea } from '@/components/ui'
import { useCommercials } from './useClients'
import { clientSchema, emptyClientInput, type Client, type ClientInput } from './types'

export function ClientForm({
  initial,
  busy,
  onDirtyChange,
  onCancel,
  onSave,
}: {
  initial?: Client
  busy: boolean
  onDirtyChange?: (dirty: boolean) => void
  onCancel: () => void
  onSave: (values: ClientInput) => void
}) {
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema.omit({
      id: true, code: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true,
    })),
    defaultValues: initial ?? emptyClientInput,
  })
  const phoneValues = useWatch({ control: form.control, name: 'telephones' }) ?? []
  const contacts = useFieldArray({ control: form.control, name: 'contacts' })
  const { data: commercials = [] } = useCommercials()
  const dirty = form.formState.isDirty

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function close() {
    if (dirty && !window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')) return
    onCancel()
  }

  const field = (name: keyof ClientInput, label: string, type = 'text') => (
    <div>
      <Label htmlFor={`client-${name}`}>{label}</Label>
      <Input id={`client-${name}`} type={type} {...form.register(name as never)} />
    </div>
  )

  return (
    <form className="max-h-[78vh] space-y-6 overflow-y-auto" onSubmit={form.handleSubmit(onSave)} noValidate>
      <section className="grid gap-3 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-heading font-semibold text-navy-900">Identité</h3>
        <div><Label htmlFor="client-type">Type de client</Label><Select id="client-type" {...form.register('typeClient')}>
          <option value="societe">Société</option><option value="particulier">Particulier</option><option value="syndic">Syndic</option><option value="administration">Administration</option>
        </Select></div>
        {field('raisonSociale', 'Raison sociale / nom complet')}
        {field('ice', 'ICE (15 chiffres)')}
        {form.formState.errors.ice?.message && <p className="text-xs text-danger-700">{form.formState.errors.ice.message}</p>}
        {field('rc', 'Registre de commerce')}
        {field('identifiantFiscal', 'Identifiant fiscal')}
        <div><Label htmlFor="client-status">Statut commercial</Label><Select id="client-status" {...form.register('statut')}>
          <option value="prospect">Prospect</option><option value="actif">Actif</option><option value="inactif">Inactif</option>
        </Select></div>
      </section>
      <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-heading font-semibold text-navy-900">Coordonnées</h3>
        {field('adresse', 'Adresse')}
        {field('ville', 'Ville')}
        {field('quartier', 'Quartier')}
        {field('codePostal', 'Code postal')}
        {field('email', 'E-mail', 'email')}
        {form.formState.errors.email?.message && <p className="text-xs text-danger-700">{form.formState.errors.email.message}</p>}
        {field('siteWeb', 'Site web', 'url')}
        <div className="space-y-2 sm:col-span-2">
          <Label>Téléphones</Label>
          {phoneValues.map((_, index) => (
            <div className="flex gap-2" key={`client-phone-${index}`}>
              <Input aria-label={`Téléphone ${index + 1}`} {...form.register(`telephones.${index}`)} />
              <Button type="button" variant="ghost" aria-label="Supprimer le téléphone" onClick={() => form.setValue('telephones', phoneValues.filter((_, phoneIndex) => phoneIndex !== index), { shouldDirty: true })}><Trash2 size={15} /></Button>
              {form.formState.errors.telephones?.[index]?.message && <span className="text-xs text-danger-700">{form.formState.errors.telephones[index]?.message}</span>}
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => form.setValue('telephones', [...phoneValues, ''], { shouldDirty: true })}><Plus size={14} /> Ajouter un téléphone</Button>
          {form.formState.errors.telephones?.root?.message && <p className="text-xs text-danger-700">{form.formState.errors.telephones.root.message}</p>}
          {form.formState.errors.telephones?.[0]?.message && <p className="text-xs text-danger-700">{form.formState.errors.telephones[0].message}</p>}
        </div>
      </section>
      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between"><h3 className="font-heading font-semibold text-navy-900">Contacts</h3><Button type="button" size="sm" variant="outline" onClick={() => contacts.append({ nom: '', fonction: '', telephone: '', email: '' })}><Plus size={14} /> Ajouter</Button></div>
        {contacts.fields.map((contact, index) => (
          <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2" key={contact.id}>
            <Input aria-label="Nom du contact" placeholder="Nom" {...form.register(`contacts.${index}.nom`)} />
            <Input aria-label="Fonction du contact" placeholder="Fonction" {...form.register(`contacts.${index}.fonction`)} />
            <Input aria-label="Téléphone du contact" placeholder="Téléphone" {...form.register(`contacts.${index}.telephone`)} />
            <div className="flex gap-2"><div className="min-w-0 flex-1"><Input aria-label="E-mail du contact" placeholder="E-mail" {...form.register(`contacts.${index}.email`)} />{form.formState.errors.contacts?.[index]?.email?.message && <p className="text-xs text-danger-700">{form.formState.errors.contacts[index]?.email?.message}</p>}</div><Button type="button" variant="ghost" aria-label="Supprimer le contact" onClick={() => contacts.remove(index)}><Trash2 size={15} /></Button></div>
          </div>
        ))}
      </section>
      <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-heading font-semibold text-navy-900">Facturation et paiement</h3>
        {field('modePaiementHabituel', 'Mode de paiement habituel')}
        <div><Label htmlFor="client-owner">Commercial responsable</Label><Select id="client-owner" {...form.register('commercialResponsableUid')}><option value="">Non attribué</option>{commercials.map((user) => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</Select></div>
        <div><Label htmlFor="client-payment-days">Délai de paiement (jours)</Label><Input id="client-payment-days" type="number" min="0" {...form.register('delaiPaiementJours', { valueAsNumber: true })} /></div>
      </section>
      <section className="border-t border-slate-100 pt-4">
        <Label htmlFor="client-notes">Notes</Label><Textarea id="client-notes" rows={3} {...form.register('notes')} />
      </section>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white py-3">
        <Button type="button" variant="outline" onClick={close}>Annuler</Button>
        <Button type="submit" loading={busy}>Enregistrer</Button>
      </div>
    </form>
  )
}
