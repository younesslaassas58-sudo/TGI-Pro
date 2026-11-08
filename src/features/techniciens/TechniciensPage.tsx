import { useMemo, useState } from 'react'
import { Archive, CalendarClock, Eye, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, Input, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { TechnicianForm } from './TechnicienForm'
import { technicianHabilitationStatus } from './technicianUtils'
import { specialtyLabels, type Technician, type TechnicianInput, type TechnicianPrivate } from './types'
import { useArchiveTechnicien, useDeleteTechnicien, useSaveTechnicien, useTechniciens } from './useTechniciens'

const statusLabel: Record<Technician['statut'], string> = {
  actif: 'Actif',
  conge: 'En congé',
  inactif: 'Inactif',
}
const statusColor: Record<Technician['statut'], string> = {
  actif: 'bg-emerald-50 text-emerald-700',
  conge: 'bg-amber-50 text-amber-700',
  inactif: 'bg-slate-100 text-slate-600',
}

export function TechniciensPage() {
  const { data = [], isLoading, error } = useTechniciens()
  const canCreate = usePermission('techniciens', 'creer')
  const canEdit = usePermission('techniciens', 'modifier')
  const canDelete = usePermission('techniciens', 'supprimer')
  const save = useSaveTechnicien()
  const archiveMutation = useArchiveTechnicien()
  const deleteMutation = useDeleteTechnicien()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [sort, setSort] = useState<'nom' | 'matricule'>('nom')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Technician | null | undefined>(undefined)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [editDirty, setEditDirty] = useState(false)
  const pageSize = 12
  const filtered = useMemo(() => data.filter((technician) =>
    (includeArchived || !technician.archive)
    && (!status || technician.statut === status)
    && (!specialty || technician.specialites.includes(specialty as Technician['specialites'][number]))
    && (!query.trim() || `${technician.prenom} ${technician.nom} ${technician.matricule} ${technician.poste} ${technician.zoneIntervention}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'))),
  ).sort((a, b) => a[sort].localeCompare(b[sort], 'fr')), [data, includeArchived, query, sort, specialty, status])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const isDirector = usePermission('parametres', 'modifier')

  async function saveTechnician(input: TechnicianInput, privateData?: TechnicianPrivate) {
    try {
      await save.mutateAsync({ input, ...(editing ? { existing: editing } : {}), ...(privateData ? { privateData } : {}) })
      toast.success(editing ? 'Fiche technicien mise à jour.' : 'Technicien ajouté.')
      setEditing(undefined)
    } catch {
      toast.error('Impossible d’enregistrer le technicien. Vérifiez vos droits et réessayez.')
    }
  }

  async function archiveTechnician(technician: Technician) {
    try {
      await archiveMutation.mutateAsync({ technician, archive: !technician.archive })
      toast.success(technician.archive ? 'Technicien restauré.' : 'Technicien archivé.')
    } catch {
      toast.error('Impossible de modifier l’archivage du technicien.')
    }
  }

  async function deleteTechnician(technician: Technician) {
    if (!window.confirm(`Supprimer définitivement la fiche de ${technician.prenom} ${technician.nom} ?`)) return
    try {
      await deleteMutation.mutateAsync(technician.id)
      toast.success('Fiche technicien supprimée.')
    } catch {
      toast.error('La suppression de la fiche technicien a échoué.')
    }
  }

  return (
    <>
      <PageHeader title="Techniciens" description="Consultez les équipes, leurs spécialités et leurs habilitations." action={
        canCreate ? <Button onClick={() => setEditing(null)}><Plus size={16} /> Nouveau technicien</Button> : undefined
      } />
      <Card className="mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="relative sm:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} placeholder="Nom, matricule, poste, zone…" className="pl-9" aria-label="Rechercher un technicien" /></label>
          <Select aria-label="Filtrer par statut" value={status} onChange={(event) => { setStatus(event.currentTarget.value); setPage(1) }}><option value="">Tous les statuts</option><option value="actif">Actif</option><option value="conge">En congé</option><option value="inactif">Inactif</option></Select>
          <Select aria-label="Filtrer par spécialité" value={specialty} onChange={(event) => { setSpecialty(event.currentTarget.value); setPage(1) }}><option value="">Toutes les spécialités</option>{Object.entries(specialtyLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</Select>
          <Select aria-label="Trier les techniciens" value={sort} onChange={(event) => { setSort(event.currentTarget.value as typeof sort); setPage(1) }}><option value="nom">Trier par nom</option><option value="matricule">Trier par matricule</option></Select>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.currentTarget.checked); setPage(1) }} /> Inclure les archivés</label>
          <p className="self-center text-sm text-slate-500">{filtered.length} technicien(s)</p>
        </div>
      </Card>
      {isLoading ? <Card className="p-8"><Spinner label="Chargement des techniciens" /></Card>
        : error ? <Card className="p-6 text-sm text-danger-700">Impossible de charger les techniciens. Vérifiez vos droits et votre connexion.</Card>
        : rows.length === 0 ? <Card className="p-12 text-center"><UserRound className="mx-auto text-slate-300" /><h2 className="mt-3 font-heading font-semibold text-navy-900">Aucun technicien trouvé</h2><p className="mt-1 text-sm text-slate-500">Ajustez les filtres ou ajoutez un technicien.</p></Card>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((technician) => <Card key={technician.id} className="p-4">
            <div className="flex items-start gap-3">
              <Avatar name={`${technician.prenom} ${technician.nom}`} src={technician.photoURL || undefined} size="lg" />
              <div className="min-w-0 flex-1">
                <Link to={`/techniciens/${technician.id}`} className="block truncate font-heading font-semibold text-navy-900 hover:text-gold-700">{technician.prenom} {technician.nom}</Link>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{technician.matricule}</p>
                <Badge className={`mt-2 ${statusColor[technician.statut]}`}>{technician.archive ? 'Archivé' : statusLabel[technician.statut]}</Badge>
              </div>
              {technician.habilitations.some((item) => technicianHabilitationStatus(item.dateExpiration) !== 'valide') && <span className="rounded-full bg-amber-50 p-2 text-amber-700" title="Habilitation expirée ou expirant dans 60 jours"><CalendarClock size={17} /></span>}
            </div>
            <p className="mt-3 truncate text-sm text-slate-600">{technician.poste || 'Poste non renseigné'}{technician.zoneIntervention ? ` · ${technician.zoneIntervention}` : ''}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{technician.specialites.map((item) => <Badge key={item} variant="default">{specialtyLabels[item]}</Badge>)}</div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <Link to={`/techniciens/${technician.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-navy-800 hover:bg-slate-50"><Eye size={15} /> Consulter</Link>
              {canEdit && <Button variant="ghost" size="sm" onClick={() => setEditing(technician)}>Modifier</Button>}
              {canEdit && <Button variant="ghost" size="sm" onClick={() => void archiveTechnician(technician)}><Archive size={14} /> {technician.archive ? 'Restaurer' : 'Archiver'}</Button>}
              {canDelete && <Button variant="ghost" size="sm" aria-label="Supprimer définitivement" onClick={() => void deleteTechnician(technician)}><Trash2 size={14} /></Button>}
            </div>
          </Card>)}
        </div>}
      {filtered.length > 0 && <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>Page {page} / {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Suivant</Button></div></div>}
      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title={editing ? 'Modifier le technicien' : 'Nouveau technicien'} className="w-[min(100%-2rem,58rem)]">
        {editing !== undefined && <TechnicianForm initial={editing ?? undefined} director={isDirector} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(undefined)} onSave={(input, privateData) => void saveTechnician(input, privateData)} />}
      </Modal>
    </>
  )
}
