import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, FileText, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Modal, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { ClientForm } from './ClientForm'
import { clientTypeLabels, type ClientInput } from './types'
import { useArchiveClient, useClient, useDeleteClient, useSaveClient } from './useClients'
import { useClients } from './useClients'

type Tab = 'information' | 'appareils' | 'devis' | 'interventions' | 'paiements'

export function ClientDetailPage() {
  const { id } = useParams()
  const { data: client, isLoading, error } = useClient(id)
  const { data: clients = [] } = useClients()
  const { data: elevators = [], isLoading: elevatorsLoading, isFetching: elevatorsFetching, error: elevatorsError } = useAscenseurs(id)
  const archive = useArchiveClient()
  const remove = useDeleteClient()
  const save = useSaveClient()
  const toast = useToast()
  const navigate = useNavigate()
  const canEdit = usePermission('clients', 'modifier')
  const canDelete = usePermission('clients', 'supprimer')
  const [tab, setTab] = useState<Tab>('information')
  const [editing, setEditing] = useState(false)
  const [editDirty, setEditDirty] = useState(false)

  if (isLoading) return <Card className="p-8"><Spinner label="Chargement de la fiche client" /></Card>
  if (error || !client) return <Card className="p-8 text-sm text-danger-700">Cette fiche client est introuvable ou inaccessible.</Card>
  const currentClient = client

  async function saveChanges(input: ClientInput) {
    const sameIce = input.ice && clients.some((entry) => entry.id !== currentClient.id && !entry.archive && entry.ice === input.ice)
    const sameName = clients.some((entry) => entry.id !== currentClient.id && !entry.archive && entry.raisonSociale.trim().toLocaleLowerCase('fr') === input.raisonSociale.trim().toLocaleLowerCase('fr'))
    if ((sameIce || sameName) && !window.confirm('Un client possédant le même ICE ou le même nom existe déjà. Enregistrer quand même ?')) return
    try {
      await save.mutateAsync({ input, existing: currentClient })
      toast.success('Fiche client mise à jour.')
      setEditing(false)
    } catch {
      toast.error('Impossible de mettre à jour le client.')
    }
  }

  async function toggleArchive() {
    try {
      await archive.mutateAsync({ client: currentClient, archive: !currentClient.archive })
      toast.success(currentClient.archive ? 'Client restauré.' : 'Client archivé.')
    } catch {
      toast.error('Impossible de modifier l’archivage du client.')
    }
  }

  async function deletePermanently() {
    if (elevatorsLoading || elevatorsFetching || elevatorsError) {
      toast.error('Impossible de vérifier les appareils liés. Réessayez avant de supprimer le client.')
      return
    }
    if (!window.confirm(`Supprimer définitivement ${currentClient.raisonSociale} ? Cette action est irréversible.`)) return
    try {
      await remove.mutateAsync(currentClient.id)
      toast.success('Client supprimé.')
      navigate('/clients', { replace: true })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'La suppression du client a échoué.')
    }
  }

  function generateSheet() {
    navigate('/documents/editor', { state: { ficha: { entity: 'client', id: currentClient.id } } })
  }

  const tabs: Array<[Tab, string]> = [
    ['information', 'Informations'], ['appareils', `Appareils (${elevators.length})`],
    ['devis', 'Devis'], ['interventions', 'Interventions'], ['paiements', 'Paiements'],
  ]

  return (
    <>
      <PageHeader title={currentClient.raisonSociale} description={`${currentClient.code} · ${currentClient.typeClient} · ${currentClient.ville || 'Ville non renseignée'}`} action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={generateSheet}><FileText size={16} /> Générer la fiche</Button>
          {canEdit && <Button variant="outline" onClick={() => void toggleArchive()}><Archive size={16} />{currentClient.archive ? 'Restaurer' : 'Archiver'}</Button>}
          {canEdit && <Button onClick={() => setEditing(true)}>Modifier</Button>}
          {canDelete && <Button variant="danger" disabled={elevatorsLoading || elevatorsFetching || Boolean(elevatorsError)} onClick={() => void deletePermanently()}><Trash2 size={16} /> Supprimer</Button>}
        </div>
      } />
      {currentClient.archive && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Cette fiche est archivée.</div>}
      <Card className="overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3">
          {tabs.map(([key, title]) => <button key={key} className={`shrink-0 rounded-t-lg px-4 py-3 text-sm font-medium ${tab === key ? 'border-b-2 border-gold-500 text-navy-900' : 'text-slate-500 hover:text-navy-800'}`} onClick={() => setTab(key)}>{title}</button>)}
        </div>
        <div className="p-5 sm:p-7">
          {tab === 'information' && <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{[
            ['Raison sociale / nom', currentClient.raisonSociale], ['Type', clientTypeLabels[currentClient.typeClient]], ['Code client', currentClient.code],
            ['ICE', currentClient.ice], ['Registre de commerce', currentClient.rc], ['Identifiant fiscal', currentClient.identifiantFiscal],
            ['Adresse', currentClient.adresse], ['Ville / quartier', [currentClient.ville, currentClient.quartier].filter(Boolean).join(' · ')],
            ['Téléphones', currentClient.telephones.filter(Boolean).join(' · ')], ['E-mail', currentClient.email],
            ['Site web', currentClient.siteWeb], ['Paiement habituel', currentClient.modePaiementHabituel],
            ['Délai de paiement', `${currentClient.delaiPaiementJours} jours`], ['Statut', currentClient.statut],
          ].map(([label, value]) => <div key={label}><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm text-slate-800">{value || '—'}</p></div>)}
            <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Contacts</p>{currentClient.contacts.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{currentClient.contacts.map((contact, index) => <div className="rounded-xl border border-slate-200 p-3 text-sm" key={`${contact.nom}-${index}`}><strong>{contact.nom || 'Contact'}</strong><p className="text-slate-500">{[contact.fonction, contact.telephone, contact.email].filter(Boolean).join(' · ') || '—'}</p></div>)}</div> : <p className="mt-1 text-sm text-slate-600">Aucun contact secondaire.</p>}</div>
            <div className="sm:col-span-2"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{currentClient.notes || '—'}</p></div>
          </div>}
          {tab === 'appareils' && <div className="space-y-4">{canEdit && <Button onClick={() => navigate(`/parc?client=${currentClient.id}`)}><Plus size={16} /> Ajouter un appareil</Button>}
            {elevators.length ? <div className="divide-y divide-slate-100">{elevators.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><Link className="font-semibold text-navy-900" to={`/parc/${item.id}`}>{item.code} · {item.typeAppareil.replaceAll('_', ' ')}</Link><p className="text-xs text-slate-500">{item.marque} {item.modele} · {item.adresseSite}</p></div><Badge>{item.etatAppareil.replaceAll('_', ' ')}</Badge></div>)}</div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucun appareil n’est lié à ce client.</p>}
          </div>}
          {['devis', 'interventions', 'paiements'].includes(tab) && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="font-medium text-slate-700">Disponible prochainement</p><p className="mt-1 text-sm text-slate-500">Cette section sera reliée à son module dédié.</p></div>}
        </div>
      </Card>
      <Modal open={editing} onClose={() => setEditing(false)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title="Modifier le client" className="w-[min(100%-2rem,56rem)]">
        {editing && <ClientForm initial={currentClient} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(false)} onSave={(values) => void saveChanges(values)} />}
      </Modal>
    </>
  )
}
