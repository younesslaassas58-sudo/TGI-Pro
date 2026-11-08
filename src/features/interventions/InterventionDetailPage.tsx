import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Pencil, Trash2, Wrench } from 'lucide-react'
import { Badge, Button, Card, Modal, Select, Textarea, useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import { useDepots } from '@/features/stock/useStock'
import { useTechniciens } from '@/features/techniciens/useTechniciens'
import { assertTransition, transitionAutorisee } from './logic'
import { InterventionForm } from './InterventionForm'
import { InterventionMediaPanel } from './InterventionMediaPanel'
import {
  interventionStatusLabels,
  interventionTypeLabels,
  priorityLabels,
  type InterventionStatus,
} from './types'
import {
  useChangeInterventionStatus,
  useDeleteIntervention,
  useIntervention,
  useSaveIntervention,
} from './useInterventions'

const nextStatuses: InterventionStatus[] = ['planifiee', 'en_cours', 'en_attente_pieces', 'terminee', 'cloturee', 'annulee']

function badgeStyle(status: InterventionStatus) {
  if (status === 'terminee' || status === 'cloturee') return 'bg-emerald-50 text-emerald-700'
  if (status === 'annulee') return 'bg-slate-100 text-slate-600'
  if (status === 'en_cours') return 'bg-blue-50 text-blue-700'
  if (status === 'en_attente_pieces') return 'bg-amber-50 text-amber-700'
  return 'bg-violet-50 text-violet-700'
}

export function InterventionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const profile = useAuth((state) => state.profile)
  const uid = useAuth((state) => state.user?.uid) ?? ''
  const { data: intervention, isLoading, error } = useIntervention(id)
  const { data: depots = [] } = useDepots()
  const { data: technicians = [] } = useTechniciens()
  const save = useSaveIntervention()
  const changeStatus = useChangeInterventionStatus()
  const remove = useDeleteIntervention()
  const isAssigned = Boolean(intervention?.techniciensUids.includes(uid))
  const canEdit = usePermission('interventions', 'modifier', { assignedToUid: isAssigned ? uid : undefined })
  const canDelete = usePermission('interventions', 'supprimer')
  const [editing, setEditing] = useState(false)
  const [editDirty, setEditDirty] = useState(false)
  const [nextStatus, setNextStatus] = useState<InterventionStatus | ''>('')
  const [reason, setReason] = useState('')
  const [depotId, setDepotId] = useState('')

  if (isLoading) return <Card className="h-52 animate-pulse bg-slate-100" />
  if (error || !intervention) return <Card><p className="font-semibold text-danger-700">Intervention introuvable ou inaccessible.</p><Button className="mt-4" variant="outline" onClick={() => navigate('/interventions')}>Retour à la liste</Button></Card>
  const record = intervention

  const assignedTechnician = profile?.role === 'technicien' && isAssigned
  const allowedStatuses = nextStatuses.filter((status) => transitionAutorisee(record.statut, status))
  const canChangeStatus = canEdit || assignedTechnician
  const assignedTechnicians = technicians.filter((technician) => record.techniciensIds.includes(technician.id))

  async function saveEdits(input: Parameters<typeof save.mutateAsync>[0]['input']) {
    try {
      await save.mutateAsync({ input, existing: record })
      setEditing(false)
      setEditDirty(false)
      toast.success('Intervention mise à jour.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Impossible d’enregistrer les modifications.')
    }
  }

  async function updateStatus() {
    if (!nextStatus) return
    try {
      assertTransition(record.statut, nextStatus)
      await changeStatus.mutateAsync({
        intervention: record,
        statut: nextStatus,
        ...(nextStatus === 'annulee' ? { annulation: reason } : {}),
        ...(depotId ? { technicienDepotId: depotId } : {}),
      })
      setNextStatus('')
      setReason('')
      toast.success(`Intervention ${interventionStatusLabels[nextStatus].toLocaleLowerCase('fr')}.`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Impossible de modifier l’état.')
    }
  }

  async function deleteIntervention() {
    if (!window.confirm(`Supprimer définitivement l’intervention ${record.numero} ?`)) return
    try {
      await remove.mutateAsync(record)
      toast.success('Intervention supprimée.')
      navigate('/interventions')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Impossible de supprimer l’intervention.')
    }
  }

  const statusLabel = nextStatus ? interventionStatusLabels[nextStatus].toLocaleLowerCase('fr') : ''
  function closeEdit() {
    if (editDirty && !window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')) return
    setEditing(false)
  }

  return <div className="space-y-5">
    <Link to="/interventions" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-navy-900"><ArrowLeft size={16} />Retour aux interventions</Link>
    <Card>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm text-slate-500">{record.numero}</p><Badge className={badgeStyle(record.statut)}>{interventionStatusLabels[record.statut]}</Badge><Badge variant={record.priorite === 'urgente' ? 'danger' : 'default'}>{priorityLabels[record.priorite]}</Badge></div>
          <h1 className="mt-2 truncate font-heading text-2xl font-bold text-navy-950">{interventionTypeLabels[record.type]} · {record.clientNomSnapshot}</h1>
          <p className="mt-1 text-slate-600">{record.ascenseurCodeSnapshot} · {record.adresseSiteSnapshot || 'Adresse de site non renseignée'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && !['terminee', 'cloturee', 'annulee'].includes(record.statut) && <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={16} />Modifier</Button>}
          {(profile?.role === 'directeur' || profile?.role === 'commercial' || assignedTechnician) && <>
            <Button variant="outline" onClick={() => navigate('/documents/editor', { state: { ficha: { entity: 'intervention', id: record.id, kind: 'bon_intervention' } } })}>Générer le bon</Button>
            <Button variant="outline" onClick={() => navigate('/documents/editor', { state: { ficha: { entity: 'intervention', id: record.id, kind: 'rapport_intervention' } } })}>Générer le rapport</Button>
          </>}
          {canDelete && <Button variant="danger" onClick={() => void deleteIntervention()} loading={remove.isPending}><Trash2 size={16} />Supprimer</Button>}
        </div>
      </div>
      {canChangeStatus && allowedStatuses.length > 0 && <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_1fr_auto]">
        <Select aria-label="Nouvel état" value={nextStatus} onChange={(event) => setNextStatus(event.currentTarget.value as InterventionStatus | '')}><option value="">Changer l’état…</option>{allowedStatuses.map((status) => <option key={status} value={status}>{interventionStatusLabels[status]}</option>)}</Select>
        {nextStatus === 'annulee' ? <Textarea aria-label="Motif d’annulation" value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Motif d’annulation obligatoire" /> : <Select aria-label="Dépôt pour les pièces" value={depotId} onChange={(event) => setDepotId(event.currentTarget.value)}><option value="">Dépôt véhicule par défaut</option>{depots.filter((depot) => depot.type === 'vehicule' && depot.actif && !depot.archive).map((depot) => <option key={depot.id} value={depot.id}>{depot.nom}</option>)}</Select>}
        <Button onClick={() => void updateStatus()} loading={changeStatus.isPending} disabled={!nextStatus || (nextStatus === 'annulee' && !reason.trim())}>Confirmer {statusLabel}</Button>
      </div>}
      {record.personneBloquee && <p className="mt-4 rounded-lg bg-danger-50 p-3 text-sm font-semibold text-danger-800">Urgence : une personne est bloquée.</p>}
    </Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 font-heading text-lg font-semibold text-navy-900">Demande</h2><dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Date prévue</dt><dd className="mt-1 flex items-center gap-2 text-sm font-medium"><CalendarDays size={15} />{record.datePrevue ? `${new Date(`${record.datePrevue.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-MA', { dateStyle: 'medium' })}${record.heurePrevue ? ` · ${record.heurePrevue}` : ''}` : 'Non planifiée'}</dd></div>
        <div><dt className="text-xs text-slate-500">Canal</dt><dd className="mt-1 text-sm font-medium">{record.canalDemande}</dd></div>
        <div><dt className="text-xs text-slate-500">Demandeur</dt><dd className="mt-1 text-sm font-medium">{record.demandeur.nom || 'Non renseigné'} · {record.demandeur.telephone || '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">Équipe affectée</dt><dd className="mt-1 text-sm font-medium">{assignedTechnicians.length ? assignedTechnicians.map((technician) => `${technician.prenom} ${technician.nom}`).join(', ') : 'Non affectée'}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{record.descriptionDemande || '—'}</dd></div>
      </dl></Card>
      <Card><h2 className="mb-3 font-heading text-lg font-semibold text-navy-900">Rapport technique</h2><dl className="space-y-3">
        <div><dt className="text-xs text-slate-500">Diagnostic</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{record.diagnostic || 'Non renseigné'}</dd></div>
        <div><dt className="text-xs text-slate-500">Travaux réalisés</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{record.travauxRealises || 'Non renseignés'}</dd></div>
        <div><dt className="text-xs text-slate-500">État après intervention</dt><dd className="mt-1 text-sm font-medium">{record.etatApresIntervention.replaceAll('_', ' ')}</dd></div>
        {record.dureeMinutes !== undefined && <div><dt className="text-xs text-slate-500">Durée</dt><dd className="mt-1 text-sm font-medium">{record.dureeMinutes} min</dd></div>}
      </dl></Card>
    </div>
    <Card><h2 className="mb-3 font-heading text-lg font-semibold text-navy-900">Pièces utilisées</h2>{record.piecesUtilisees.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="text-xs text-slate-500"><th className="pb-2">Désignation</th><th className="pb-2">Quantité</th><th className="pb-2">Mouvement stock</th></tr></thead><tbody>{record.piecesUtilisees.map((part) => <tr key={part.id} className="border-t border-slate-100"><td className="py-2">{part.designation}</td><td className="py-2">{part.quantite} {part.unite}</td><td className="py-2">{record.mouvementsStockGeneres ? 'Sortie générée' : 'À la terminaison'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">Aucune pièce renseignée.</p>}</Card>

    <InterventionMediaPanel interventionId={record.id} signatureMediaId={record.signatureMediaId} assignedToUid={isAssigned ? uid : undefined} status={record.statut} />

    <Card><h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold text-navy-900"><Wrench size={18} />Historique des états</h2><ol className="space-y-3">{[...record.historiqueStatuts].reverse().map((entry, index) => <li key={`${entry.date}-${index}`} className="flex items-start gap-3"><span className="mt-1 size-2 shrink-0 rounded-full bg-gold-500" /><div><p className="text-sm font-semibold">{interventionStatusLabels[entry.statut]}</p><p className="text-xs text-slate-500">{new Date(entry.date).toLocaleString('fr-MA')} · {entry.nom}</p></div></li>)}</ol>{record.annulation && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">Motif d’annulation : {record.annulation}</p>}</Card>

    <Modal open={editing} onClose={() => setEditing(false)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title={`Modifier ${record.numero}`} className="w-[min(100%-2rem,60rem)]">
      {editing && <InterventionForm existing={record} reportOnly={profile?.role === 'technicien'} onDirtyChange={setEditDirty} busy={save.isPending} onCancel={closeEdit} onSave={(input) => void saveEdits(input)} />}
    </Modal>
  </div>
}
