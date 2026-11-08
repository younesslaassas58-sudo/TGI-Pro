import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, LayoutGrid, List, Plus, Search, Wrench } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import { interventionEnRetard } from './logic'
import { InterventionForm } from './InterventionForm'
import {
  interventionStatusLabels,
  interventionTypeLabels,
  priorityLabels,
  type Intervention,
  type InterventionStatus,
} from './types'
import { useCreateIntervention, useGenerateMonthlyVisits, useInterventions } from './useInterventions'

type ViewMode = 'liste' | 'kanban' | 'planning'

const statuses: InterventionStatus[] = ['nouvelle', 'planifiee', 'en_cours', 'en_attente_pieces', 'terminee', 'cloturee', 'annulee']

function statusStyle(status: InterventionStatus) {
  if (status === 'terminee' || status === 'cloturee') return 'bg-emerald-50 text-emerald-700'
  if (status === 'annulee') return 'bg-slate-100 text-slate-600'
  if (status === 'en_cours') return 'bg-blue-50 text-blue-700'
  if (status === 'en_attente_pieces') return 'bg-amber-50 text-amber-700'
  return 'bg-violet-50 text-violet-700'
}

function InterventionCard({ intervention, onOpen }: { intervention: Intervention; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="w-full text-left">
    <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-slate-500">{intervention.numero}</p>
          <h3 className="mt-1 truncate font-semibold text-navy-900">{intervention.clientNomSnapshot}</h3>
          <p className="mt-1 text-sm text-slate-600">{intervention.ascenseurCodeSnapshot} · {interventionTypeLabels[intervention.type]}</p>
        </div>
        <Badge className={statusStyle(intervention.statut)}>{interventionStatusLabels[intervention.statut]}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{intervention.descriptionDemande || 'Aucune description.'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{intervention.datePrevue ? `${new Date(`${intervention.datePrevue.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-MA', { dateStyle: 'medium' })}${intervention.heurePrevue ? ` · ${intervention.heurePrevue}` : ''}` : 'Sans date'}</span>
        <Badge variant={intervention.priorite === 'urgente' ? 'danger' : 'default'}>{priorityLabels[intervention.priorite]}</Badge>
        {interventionEnRetard(intervention) && <Badge variant="danger">En retard</Badge>}
        {intervention.personneBloquee && <Badge variant="danger">Personne bloquée</Badge>}
      </div>
    </Card>
  </button>
}

export function InterventionsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const profile = useAuth((state) => state.profile)
  const { data = [], isLoading, error } = useInterventions()
  const create = useCreateIntervention()
  const generateVisits = useGenerateMonthlyVisits()
  const canCreate = usePermission('interventions', 'creer')
  const [view, setView] = useState<ViewMode>('liste')
  const [open, setOpen] = useState(Boolean(searchParams.get('clientId') || searchParams.get('ascenseurId')))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [visitMonth, setVisitMonth] = useState(new Date().toISOString().slice(0, 7))
  const [planningOpen, setPlanningOpen] = useState(false)
  const [createDirty, setCreateDirty] = useState(false)

  const visible = useMemo(() => data.filter((item) => {
    const term = search.trim().toLocaleLowerCase('fr')
    return (!term || `${item.numero} ${item.clientNomSnapshot} ${item.ascenseurCodeSnapshot} ${item.adresseSiteSnapshot} ${item.descriptionDemande}`.toLocaleLowerCase('fr').includes(term))
      && (!statusFilter || item.statut === statusFilter)
      && (!priorityFilter || item.priorite === priorityFilter)
      && !item.archive
  }).sort((a, b) => b.datePrevue.localeCompare(a.datePrevue)), [data, priorityFilter, search, statusFilter])

  async function save(input: Parameters<typeof create.mutateAsync>[0]) {
    try {
      const created = await create.mutateAsync(input)
      setOpen(false)
      setCreateDirty(false)
      toast.success('Intervention créée.')
      navigate(`/interventions/${created.id}`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Impossible de créer l’intervention.')
    }
  }

  const grouped = statuses.map((status) => ({ status, items: visible.filter((item) => item.statut === status) }))
  const initialValues = useMemo(() => ({
    ...(searchParams.get('clientId') ? { clientId: searchParams.get('clientId') ?? '' } : {}),
    ...(searchParams.get('ascenseurId') ? { ascenseurId: searchParams.get('ascenseurId') ?? '' } : {}),
  }), [searchParams])

  function closeCreate() {
    if (createDirty && !window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')) return
    setOpen(false)
  }

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">Opérations terrain</p>
        <h1 className="mt-1 font-heading text-3xl font-bold text-navy-950">Interventions</h1>
        <p className="mt-2 text-sm text-slate-600">Planifiez, affectez et suivez les interventions sur le parc.</p>
      </div>
      {canCreate && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setPlanningOpen(true)}>Générer les visites mensuelles</Button><Button onClick={() => setOpen(true)}><Plus size={17} />Nouvelle intervention</Button></div>}
    </header>

    <Card>
      <div className="grid gap-3 md:grid-cols-[minmax(15rem,1fr)_12rem_12rem_auto]">
        <label className="relative block"><span className="sr-only">Rechercher une intervention</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="N° intervention, client, appareil…" /></label>
        <Select aria-label="Filtrer par état" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option value="">Tous les états</option>{statuses.map((status) => <option key={status} value={status}>{interventionStatusLabels[status]}</option>)}</Select>
        <Select aria-label="Filtrer par priorité" value={priorityFilter} onChange={(event) => setPriorityFilter(event.currentTarget.value)}><option value="">Toutes les priorités</option>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
        <div className="flex rounded-xl border border-slate-200 p-1" aria-label="Mode d’affichage">
          <Button size="sm" variant={view === 'liste' ? 'secondary' : 'ghost'} aria-label="Affichage liste" onClick={() => setView('liste')}><List size={16} /></Button>
          <Button size="sm" variant={view === 'kanban' ? 'secondary' : 'ghost'} aria-label="Affichage tableau" onClick={() => setView('kanban')}><LayoutGrid size={16} /></Button>
          <Button size="sm" variant={view === 'planning' ? 'secondary' : 'ghost'} aria-label="Affichage planning" onClick={() => setView('planning')}><CalendarDays size={16} /></Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{visible.length} intervention{visible.length > 1 ? 's' : ''}{profile?.role === 'technicien' ? ' vous concernant' : ''}</p>
    </Card>

    {error && <Card className="border-danger-200 bg-danger-50 text-danger-800">Impossible de charger les interventions. Vérifiez votre connexion et vos autorisations.</Card>}
    {isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-40 animate-pulse bg-slate-100" />)}</div>
      : visible.length === 0 ? <EmptyState icon={<Wrench size={24} />} title="Aucune intervention" description="Aucune intervention ne correspond à ces critères." action={canCreate ? <Button onClick={() => setOpen(true)}>Créer une intervention</Button> : undefined} />
        : view === 'kanban' ? <div className="flex gap-4 overflow-x-auto pb-2">{grouped.filter((group) => group.items.length || !statusFilter).map((group) => <section key={group.status} className="min-w-64 flex-1 space-y-3 rounded-2xl bg-slate-100/70 p-3"><h2 className="flex items-center justify-between text-sm font-semibold text-navy-900">{interventionStatusLabels[group.status]}<span className="rounded-full bg-white px-2 py-0.5 text-xs">{group.items.length}</span></h2>{group.items.map((item) => <InterventionCard key={item.id} intervention={item} onOpen={() => navigate(`/interventions/${item.id}`)} />)}</section>)}</div>
          : view === 'planning' ? <div className="space-y-4">{[...new Set(visible.map((item) => item.datePrevue.slice(0, 10)))].map((date) => <section key={date}><h2 className="mb-2 flex items-center gap-2 font-semibold text-navy-900"><CalendarDays size={17} />{new Date(`${date}T12:00:00`).toLocaleDateString('fr-MA', { dateStyle: 'full' })}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.filter((item) => item.datePrevue.slice(0, 10) === date).map((item) => <InterventionCard key={item.id} intervention={item} onOpen={() => navigate(`/interventions/${item.id}`)} />)}</div></section>)}</div>
            : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map((item) => <InterventionCard key={item.id} intervention={item} onOpen={() => navigate(`/interventions/${item.id}`)} />)}</div>}
    <Modal open={open} onClose={() => setOpen(false)} beforeClose={() => !createDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title="Nouvelle intervention" className="w-[min(100%-2rem,60rem)]">
      <InterventionForm initialValues={initialValues} onDirtyChange={setCreateDirty} busy={create.isPending} onCancel={closeCreate} onSave={(input) => void save(input)} />
    </Modal>
    <Modal open={planningOpen} onClose={() => setPlanningOpen(false)} title="Générer les visites d’entretien">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Les visites dues ce mois-ci seront créées à partir des contrats actifs et des prochaines dates indiquées dans le parc. Les visites déjà planifiées ne seront pas dupliquées.</p>
        <label className="block text-sm font-medium text-slate-700" htmlFor="visit-month">Mois à planifier</label>
        <Input id="visit-month" type="month" value={visitMonth} onChange={(event) => setVisitMonth(event.currentTarget.value)} />
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPlanningOpen(false)}>Annuler</Button><Button loading={generateVisits.isPending} onClick={async () => {
          try {
            const result = await generateVisits.mutateAsync(visitMonth)
            setPlanningOpen(false)
            toast.success(result.count ? `${result.count} visite(s) planifiée(s).` : 'Aucune nouvelle visite à planifier.')
          } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Impossible de générer les visites.')
          }
        }}>Générer les visites</Button></div>
      </div>
    </Modal>
  </div>
}
