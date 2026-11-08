import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Copy } from 'lucide-react'
import { useForm, useWatch, type Path } from 'react-hook-form'
import { Button, Input, Label, Select, Textarea } from '@/components/ui'
import { ClientPicker } from '@/features/clients/ClientPicker'
import { useClients } from '@/features/clients/useClients'
import type { Ascenseur, AscenseurInput } from './types'
import { ascenseurSchema, emptyAscenseurInput, nextVisitDate } from './types'

export function AscenseurForm({
  initial,
  initialClientId = '',
  busy,
  onDirtyChange,
  onCancel,
  onSave,
}: {
  initial?: Ascenseur
  initialClientId?: string
  busy: boolean
  onDirtyChange?: (dirty: boolean) => void
  onCancel: () => void
  onSave: (values: AscenseurInput) => void
}) {
  const { data: clients = [] } = useClients()
  const form = useForm<AscenseurInput>({
    resolver: zodResolver(ascenseurSchema.omit({
      id: true, code: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true,
    })),
    defaultValues: initial ?? { ...emptyAscenseurInput, clientId: initialClientId },
  })
  const clientId = useWatch({ control: form.control, name: 'clientId' })
  const lastVisit = useWatch({ control: form.control, name: 'derniereVisite' })
  const interval = useWatch({ control: form.control, name: 'periodiciteVisiteJours' })
  const setValue = form.setValue
  const dirty = form.formState.isDirty
  const client = clients.find((item) => item.id === clientId)

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

  useEffect(() => {
    setValue('prochaineVisite', nextVisitDate(lastVisit, interval ?? 0), { shouldDirty: false })
  }, [setValue, lastVisit, interval])

  const field = (name: keyof AscenseurInput, label: string, type = 'text') => (
    <div>
      <Label htmlFor={`elevator-${name}`}>{label}</Label>
      <Input id={`elevator-${name}`} type={type} {...form.register(name as Path<AscenseurInput>, type === 'number' ? { valueAsNumber: true } : undefined)} />
    </div>
  )

  function close() {
    if (dirty && !window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')) return
    onCancel()
  }

  return (
    <form className="max-h-[78vh] space-y-6 overflow-y-auto" onSubmit={form.handleSubmit((values) => onSave({
      ...values,
      clientNomSnapshot: client?.raisonSociale ?? initial?.clientNomSnapshot ?? '',
      prochaineVisite: nextVisitDate(values.derniereVisite, values.periodiciteVisiteJours),
    }))}>
      <section className="space-y-3">
        <h3 className="font-heading font-semibold text-navy-900">Client et site</h3>
        <ClientPicker value={clientId} onChange={(id) => form.setValue('clientId', id, { shouldDirty: true })} />
        {client && <Button type="button" size="sm" variant="outline" onClick={() => {
          form.setValue('adresseSite', client.adresse, { shouldDirty: true })
          form.setValue('villeSite', client.ville, { shouldDirty: true })
        }}><Copy size={14} /> Copier l’adresse du client</Button>}
        <div className="grid gap-3 sm:grid-cols-2">{field('adresseSite', 'Adresse du site')}{field('villeSite', 'Ville')}{field('batiment', 'Bâtiment')}</div>
      </section>
      <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-heading font-semibold text-navy-900">Caractéristiques techniques</h3>
        <div><Label htmlFor="elevator-type">Type d’appareil</Label><Select id="elevator-type" {...form.register('typeAppareil')}><option value="ascenseur">Ascenseur</option><option value="monte_charge">Monte-charge</option><option value="monte_plat">Monte-plat</option><option value="monte_personne_pmr">Monte-personne PMR</option><option value="autre">Autre</option></Select></div>
        {field('marque', 'Marque')}{field('modele', 'Modèle')}{field('numeroSerie', 'Numéro de série')}
        {field('anneeInstallation', 'Année d’installation', 'number')}{field('capaciteKg', 'Capacité (kg)', 'number')}
        {field('capacitePersonnes', 'Capacité (personnes)', 'number')}{field('nombreNiveaux', 'Nombre de niveaux', 'number')}
        {field('nombreArrets', 'Nombre d’arrêts', 'number')}{field('vitesse', 'Vitesse')}{field('typeCommande', 'Type de commande')}
        <div><Label htmlFor="elevator-machinery">Machinerie</Label><Select id="elevator-machinery" {...form.register('machinerie')}><option value="avec_local">Avec local</option><option value="sans_local">Sans local</option></Select></div>
        <div><Label htmlFor="elevator-state">État</Label><Select id="elevator-state" {...form.register('etatAppareil')}><option value="en_service">En service</option><option value="en_panne">En panne</option><option value="a_l_arret">À l’arrêt</option><option value="en_modernisation">En modernisation</option></Select></div>
      </section>
      <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <h3 className="sm:col-span-2 font-heading font-semibold text-navy-900">Contrat d’entretien et visites</h3>
        <div><Label htmlFor="elevator-contract">Contrat</Label><Select id="elevator-contract" {...form.register('contrat')}><option value="aucun">Aucun</option><option value="entretien_mensuel">Entretien mensuel</option><option value="entretien_trimestriel">Entretien trimestriel</option><option value="entretien_semestriel">Entretien semestriel</option><option value="entretien_annuel">Entretien annuel</option></Select></div>
        {field('contratDebut', 'Début du contrat', 'date')}{field('contratFin', 'Fin du contrat', 'date')}{field('montantContrat', 'Montant du contrat (MAD)', 'number')}
        {field('periodiciteVisiteJours', 'Périodicité visite (jours)', 'number')}{field('derniereVisite', 'Dernière visite', 'date')}
        <div><Label htmlFor="elevator-next">Prochaine visite (calculée)</Label><Input id="elevator-next" type="date" readOnly {...form.register('prochaineVisite')} /></div>
      </section>
      <section className="border-t border-slate-100 pt-4"><Label htmlFor="elevator-notes">Notes</Label><Textarea id="elevator-notes" rows={3} {...form.register('notes')} /></section>
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white py-3"><Button type="button" variant="outline" onClick={close}>Annuler</Button><Button type="submit" loading={busy}>Enregistrer l’appareil</Button></div>
    </form>
  )
}
