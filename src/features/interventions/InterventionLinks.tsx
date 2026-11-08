import { Link } from 'react-router-dom'
import { Badge, Card, Spinner } from '@/components/ui'
import { interventionStatusLabels, interventionTypeLabels, type Intervention } from './types'

export function InterventionLinks({
  interventions,
  isLoading,
  error,
  emptyMessage = 'Aucune intervention liée.',
}: {
  interventions: Intervention[]
  isLoading: boolean
  error: boolean
  emptyMessage?: string
}) {
  if (isLoading) return <Card className="p-6"><Spinner label="Chargement des interventions" /></Card>
  if (error) return <p role="alert" className="rounded-xl bg-danger-50 p-4 text-sm text-danger-700">Impossible de charger les interventions.</p>
  if (!interventions.length) return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">{emptyMessage}</p>
  return <div className="divide-y divide-slate-100">{interventions.map((item) => <Link key={item.id} to={`/interventions/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50">
    <span><strong className="block text-navy-900">{item.numero} · {interventionTypeLabels[item.type]}</strong><span className="text-xs text-slate-500">{item.datePrevue.slice(0, 10) || 'Date non planifiée'} · {item.descriptionDemande || 'Sans description'}</span></span>
    <Badge>{interventionStatusLabels[item.statut]}</Badge>
  </Link>)}</div>
}
