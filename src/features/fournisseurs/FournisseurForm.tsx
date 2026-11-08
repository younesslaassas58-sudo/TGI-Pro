import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Path } from 'react-hook-form'
import { Button, Input, Label, Textarea } from '@/components/ui'
import { fournisseurSchema, emptyFournisseurInput, type Fournisseur, type FournisseurInput } from './types'

const inputSchema = fournisseurSchema.omit({
  id: true,
  code: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
})

export function FournisseurForm({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial?: Fournisseur
  busy: boolean
  onCancel: () => void
  onSave: (values: FournisseurInput) => void
}) {
  const form = useForm<FournisseurInput>({
    resolver: zodResolver(inputSchema),
    defaultValues: initial ?? emptyFournisseurInput,
  })

  const field = (name: keyof FournisseurInput, label: string, type = 'text') => (
    <div>
      <Label htmlFor={`fournisseur-${name}`}>{label}</Label>
      <Input
        id={`fournisseur-${name}`}
        type={type}
        {...form.register(name as Path<FournisseurInput>, type === 'number' ? { valueAsNumber: true } : undefined)}
      />
      {form.formState.errors[name]?.message && <p className="mt-1 text-xs text-danger-700">{form.formState.errors[name]?.message}</p>}
    </div>
  )

  return (
    <form className="max-h-[78vh] space-y-5 overflow-y-auto" onSubmit={form.handleSubmit((values) => onSave({
      ...values,
      archive: initial?.archive ?? false,
    }))}>
      <section className="grid gap-3 sm:grid-cols-2">
        <h3 className="font-heading font-semibold text-navy-900 sm:col-span-2">Identité et coordonnées</h3>
        {field('raisonSociale', 'Raison sociale')}
        {field('ice', 'ICE (15 chiffres)')}
        {field('rc', 'Registre de commerce')}
        {field('identifiantFiscal', 'Identifiant fiscal')}
        {field('telephone', 'Téléphone', 'tel')}
        {field('email', 'E-mail', 'email')}
        {field('adresse', 'Adresse')}
        {field('ville', 'Ville')}
        {field('codePostal', 'Code postal')}
      </section>
      <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <h3 className="font-heading font-semibold text-navy-900 sm:col-span-2">Contact et paiement</h3>
        {field('contactNom', 'Nom du contact')}
        {field('contactFonction', 'Fonction')}
        {field('contactTelephone', 'Téléphone du contact', 'tel')}
        {field('contactEmail', 'E-mail du contact', 'email')}
        {field('modePaiement', 'Mode de paiement')}
        {field('delaiPaiementJours', 'Délai de paiement (jours)', 'number')}
        {field('rib', 'RIB')}
      </section>
      <div>
        <Label htmlFor="fournisseur-notes">Notes</Label>
        <Textarea id="fournisseur-notes" rows={3} {...form.register('notes')} />
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={busy}>Enregistrer le fournisseur</Button>
      </div>
    </form>
  )
}
