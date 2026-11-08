import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { FileText, Trash2, Wrench } from 'lucide-react'
import { Button, Card, Modal, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { useDeleteAscenseur, useAscenseur, useSaveAscenseur } from './useAscenseurs'
import { AscenseurForm } from './AscenseurForm'
import type { AscenseurInput } from './types'
import { useInterventions } from '@/features/interventions/useInterventions'
import { InterventionLinks } from '@/features/interventions/InterventionLinks'

export function AscenseurDetailPage() {
  const { id } = useParams()
  const { data: item, isLoading, error } = useAscenseur(id)
  const save = useSaveAscenseur()
  const remove = useDeleteAscenseur()
  const { data: interventions = [], isLoading: interventionsLoading, error: interventionsError } = useInterventions()
  const canEdit = usePermission('parc', 'modifier')
  const canCreateIntervention = usePermission('interventions', 'creer')
  const canDelete = usePermission('parc', 'supprimer')
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [editDirty, setEditDirty] = useState(false)

  if (isLoading) return <Card className="p-8"><Spinner label="Chargement de la fiche appareil" /></Card>
  if (error || !item) return <Card className="p-8 text-sm text-danger-700">Cet appareil est introuvable ou inaccessible.</Card>
  const currentItem = item
  const elevatorInterventions = interventions.filter((intervention) => intervention.ascenseurId === currentItem.id && !intervention.archive)

  async function saveChanges(input: AscenseurInput) {
    try {
      await save.mutateAsync({ input, existing: currentItem })
      toast.success('Appareil mis à jour.')
      setEditing(false)
    } catch {
      toast.error('Impossible de mettre à jour l’appareil.')
    }
  }

  async function toggleService() {
    const state = currentItem.etatAppareil === 'en_panne' ? 'en_service' : 'en_panne'
    if (!window.confirm(state === 'en_panne' ? 'Marquer cet appareil en panne ?' : 'Remettre cet appareil en service ?')) return
    try {
      await save.mutateAsync({ input: { ...currentItem, etatAppareil: state }, existing: currentItem })
      toast.success(state === 'en_panne' ? 'Appareil marqué en panne.' : 'Appareil remis en service.')
    } catch {
      toast.error('Impossible de modifier l’état de l’appareil.')
    }
  }

  async function deletePermanently() {
    if (!window.confirm(`Supprimer définitivement l’appareil ${currentItem.code} ?`)) return
    try {
      await remove.mutateAsync(currentItem.id)
      toast.success('Appareil supprimé.')
      navigate('/parc', { replace: true })
    } catch {
      toast.error('La suppression de l’appareil a échoué.')
    }
  }

  function generateSheet() {
    navigate('/documents/editor', { state: { ficha: { entity: 'ascenseur', id: currentItem.id } } })
  }

  return (
    <>
      <PageHeader title={`${currentItem.code} · ${currentItem.typeAppareil.replaceAll('_', ' ')}`} description={`${currentItem.marque} ${currentItem.modele} · ${currentItem.clientNomSnapshot}`} action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={generateSheet}><FileText size={16} /> Générer la fiche</Button>
          {canCreateIntervention && <Button variant="outline" onClick={() => navigate(`/interventions?clientId=${encodeURIComponent(currentItem.clientId)}&ascenseurId=${encodeURIComponent(currentItem.id)}`)}>Créer une intervention</Button>}
          {canEdit && <Button variant="outline" onClick={() => setEditing(true)}>Modifier</Button>}
          {canEdit && <Button variant={currentItem.etatAppareil === 'en_panne' ? 'primary' : 'danger'} onClick={() => void toggleService()}><Wrench size={16} />{currentItem.etatAppareil === 'en_panne' ? 'Remettre en service' : 'Marquer en panne'}</Button>}
          {canDelete && <Button variant="danger" onClick={() => void deletePermanently()}><Trash2 size={16} /> Supprimer</Button>}
        </div>
      } />
      <div className="grid gap-5 lg:grid-cols-[1fr_0.7fr]">
        <Card className="p-5 sm:p-7">
          <h2 className="font-heading text-lg font-semibold text-navy-900">Fiche technique</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">{[
            ['Client', <Link to={`/clients/${currentItem.clientId}`} className="text-navy-700 underline">{currentItem.clientNomSnapshot}</Link>],
            ['Adresse du site', [currentItem.adresseSite, currentItem.batiment, currentItem.villeSite].filter(Boolean).join(' · ')],
            ['Marque / modèle', `${currentItem.marque} ${currentItem.modele}`], ['Numéro de série', currentItem.numeroSerie],
            ['Année d’installation', currentItem.anneeInstallation], ['Capacité', `${currentItem.capaciteKg} kg · ${currentItem.capacitePersonnes} personnes`],
            ['Niveaux / arrêts', `${currentItem.nombreNiveaux} niveaux · ${currentItem.nombreArrets} arrêts`], ['Vitesse', currentItem.vitesse],
            ['Commande', currentItem.typeCommande], ['Machinerie', currentItem.machinerie.replaceAll('_', ' ')],
          ].map(([label, value]) => <div key={String(label)}><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-sm text-slate-800">{value || '—'}</p></div>)}</div>
          <div className="mt-7 border-t border-slate-100 pt-5"><h3 className="mb-3 font-heading font-semibold text-navy-900">Historique des interventions</h3><InterventionLinks interventions={elevatorInterventions} isLoading={interventionsLoading} error={Boolean(interventionsError)} /></div>
        </Card>
        <Card className="h-fit p-5 sm:p-7">
          <h2 className="font-heading text-lg font-semibold text-navy-900">Contrat et visites</h2>
          <div className="mt-5 space-y-4">{[
            ['État de l’appareil', currentItem.etatAppareil.replaceAll('_', ' ')],
            ['Contrat', currentItem.contrat.replaceAll('_', ' ')],
            ['Période du contrat', [currentItem.contratDebut, currentItem.contratFin].filter(Boolean).join(' → ')],
            ['Montant', `${currentItem.montantContrat.toLocaleString('fr-FR')} MAD`],
            ['Dernière visite', currentItem.derniereVisite || '—'],
            ['Prochaine visite', currentItem.prochaineVisite || 'Non planifiée'],
            ['Périodicité', `${currentItem.periodiciteVisiteJours} jours`],
          ].map(([label, value]) => <div className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm" key={label}><span className="text-slate-500">{label}</span><strong className="text-right text-slate-800">{value}</strong></div>)}</div>
          <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{currentItem.notes || '—'}</p>
        </Card>
      </div>
      <Modal open={editing} onClose={() => setEditing(false)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title="Modifier l’appareil" className="w-[min(100%-2rem,56rem)]">
        {editing && <AscenseurForm initial={currentItem} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(false)} onSave={(values) => void saveChanges(values)} />}
      </Modal>
    </>
  )
}
