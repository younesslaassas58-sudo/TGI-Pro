import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Archive, FileText, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, Modal, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { useCommandes } from '@/features/commandes/useCommandes'
import { orderStatusLabels } from '@/features/commandes/types'
import { useDevis } from '@/features/devis/useDevis'
import { quoteStatusLabels } from '@/features/devis/types'
import { useLivraisons } from '@/features/livraisons/useLivraisons'
import { useContrats, useEcheances } from '@/features/recouvrement/useRecouvrement'
import { formatDate, formatMoney } from '@/lib/format'
import { ClientForm } from './ClientForm'
import { clientTypeLabels, type ClientInput } from './types'
import { useArchiveClient, useClient, useDeleteClient, useSaveClient } from './useClients'
import { useClients } from './useClients'
import { useInterventions } from '@/features/interventions/useInterventions'
import { InterventionLinks } from '@/features/interventions/InterventionLinks'

type Tab = 'information' | 'appareils' | 'devis' | 'commandes' | 'livraisons' | 'contrats' | 'interventions' | 'paiements'

export function ClientDetailPage() {
  const { id } = useParams()
  const { data: client, isLoading, error } = useClient(id)
  const { data: clients = [] } = useClients()
  const { data: elevators = [], isLoading: elevatorsLoading, isFetching: elevatorsFetching, error: elevatorsError } = useAscenseurs(id)
  const { data: quotes = [], isLoading: quotesLoading, error: quotesError } = useDevis()
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useCommandes()
  const { data: deliveries = [], isLoading: deliveriesLoading, error: deliveriesError } = useLivraisons()
  const archive = useArchiveClient()
  const remove = useDeleteClient()
  const save = useSaveClient()
  const toast = useToast()
  const navigate = useNavigate()
  const canEdit = usePermission('clients', 'modifier')
  const canCreateIntervention = usePermission('interventions', 'creer')
  const canDelete = usePermission('clients', 'supprimer')
  const canViewRecovery = usePermission('recouvrement', 'voir')
  const { data: contracts = [] } = useContrats(canViewRecovery)
  const { data: dueItems = [] } = useEcheances(canViewRecovery)
  const { data: interventions = [], isLoading: interventionsLoading, error: interventionsError } = useInterventions()
  const [tab, setTab] = useState<Tab>('information')
  const [editing, setEditing] = useState(false)
  const [editDirty, setEditDirty] = useState(false)

  if (isLoading) return <Card className="p-8"><Spinner label="Chargement de la fiche client" /></Card>
  if (error || !client) return <Card className="p-8 text-sm text-danger-700">Cette fiche client est introuvable ou inaccessible.</Card>
  const currentClient = client
  const clientQuotes = quotes.filter((quote) => quote.client.id === currentClient.id)
  const clientOrders = orders.filter((order) => order.kind === 'client' && order.party.id === currentClient.id)
  const clientDeliveries = deliveries.filter((delivery) => delivery.client.id === currentClient.id)
  const clientContracts = contracts.filter((item) => item.clientId === currentClient.id && !item.archive)
  const clientDueItems = dueItems.filter((item) => item.clientId === currentClient.id && item.statut === 'ouverte')
  const clientInterventions = interventions.filter((item) => item.clientId === currentClient.id && !item.archive)
  const clientBalance = clientDueItems.reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)

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
    ['devis', `Devis (${clientQuotes.length})`], ['commandes', `Commandes (${clientOrders.length})`],
    ['livraisons', `Livraisons (${clientDeliveries.length})`],
    ...(canViewRecovery ? [['contrats', `Contrats (${clientContracts.length})`] as [Tab, string]] : []),
    ['interventions', 'Interventions'], ['paiements', 'Paiements'],
  ]

  return (
    <>
      <PageHeader title={currentClient.raisonSociale} description={`${currentClient.code} · ${currentClient.typeClient} · ${currentClient.ville || 'Ville non renseignée'}`} action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={generateSheet}><FileText size={16} /> Générer la fiche</Button>
          {canCreateIntervention && <Button variant="outline" onClick={() => navigate(`/interventions?clientId=${encodeURIComponent(currentClient.id)}`)}><Plus size={16} /> Créer une intervention</Button>}
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
          {tab === 'devis' && <div className="space-y-4">
            {canEdit && <Button onClick={() => navigate(`/devis?clientId=${encodeURIComponent(currentClient.id)}`)}><Plus size={16} /> Créer un devis</Button>}
            {quotesLoading ? <Spinner label="Chargement des devis" /> : quotesError ? <p className="text-sm text-danger-700">Impossible de charger les devis.</p> : clientQuotes.length ? <div className="divide-y divide-slate-100">{clientQuotes.map((quote) => <Link key={quote.id} to="/devis" className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50"><span><strong className="block text-navy-900">{quote.number}</strong><span className="text-xs text-slate-500">Émis le {formatDate(quote.issueDate)}</span></span><span className="flex items-center gap-3"><Badge>{quoteStatusLabels[quote.status]}</Badge><strong>{formatMoney(quote.totals.totalTTCCents / 100)}</strong></span></Link>)}</div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucun devis pour ce client.</p>}
          </div>}
          {tab === 'commandes' && <div className="space-y-4">
            {canEdit && <Button onClick={() => navigate(`/commandes?clientId=${encodeURIComponent(currentClient.id)}`)}><Plus size={16} /> Créer une commande</Button>}
            {ordersLoading ? <Spinner label="Chargement des commandes" /> : ordersError ? <p className="text-sm text-danger-700">Impossible de charger les commandes.</p> : clientOrders.length ? <div className="divide-y divide-slate-100">{clientOrders.map((order) => <Link key={order.id} to="/commandes" className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50"><span><strong className="block text-navy-900">{order.number}</strong><span className="text-xs text-slate-500">Commandée le {formatDate(order.orderDate)}</span></span><span className="flex items-center gap-3"><Badge>{orderStatusLabels[order.status]}</Badge><strong>{formatMoney(order.totals.totalTTCCents / 100)}</strong></span></Link>)}</div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune commande pour ce client.</p>}
          </div>}
          {tab === 'livraisons' && <div className="space-y-4">
            {deliveriesLoading ? <Spinner label="Chargement des livraisons" /> : deliveriesError ? <p className="text-sm text-danger-700">Impossible de charger les livraisons.</p> : clientDeliveries.length ? <div className="divide-y divide-slate-100">{clientDeliveries.map((delivery) => <Link key={delivery.id} to="/livraisons" className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-slate-50"><span><strong className="block text-navy-900">{delivery.number}</strong><span className="text-xs text-slate-500">Commande {delivery.orderNumber} · {delivery.deliveredAt ? formatDate(delivery.deliveredAt.slice(0, 10)) : 'Date non renseignée'}</span></span><Badge>{delivery.status === 'cancelled' ? 'Annulée' : 'Livrée'}</Badge></Link>)}</div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucune livraison pour ce client.</p>}
          </div>}
          {tab === 'contrats' && <div className="space-y-4">
            <div className="flex items-center justify-between gap-2"><p className="text-sm text-slate-600">Solde des échéances ouvertes : <strong>{formatMoney(clientBalance / 100)}</strong></p><Button size="sm" onClick={() => navigate(`/recouvrement/clients/${currentClient.id}`)}>Situation de recouvrement</Button></div>
            {clientContracts.length ? <div className="divide-y divide-slate-100">{clientContracts.map((item) => <Link key={item.id} to={`/recouvrement/contrats/${item.id}`} className="flex flex-wrap justify-between gap-3 py-3"><span><strong className="text-navy-900">{item.numero} · {item.typePrestation}</strong><small className="block text-slate-500">{item.periodicite} · {item.ascenseursCodes.join(', ') || 'Sans appareil'}</small></span><Badge>{item.statut}</Badge></Link>)}</div> : <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Aucun contrat de recouvrement.</p>}
          </div>}
          {tab === 'paiements' && canViewRecovery && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Solde à encaisser</p><p className="text-xl font-bold text-navy-900">{formatMoney(clientBalance / 100)}</p><p className="text-xs text-slate-500">{clientDueItems.length} échéance(s) ouverte(s)</p></div><Button onClick={() => navigate(`/recouvrement/clients/${currentClient.id}`)}>Voir la situation et encaisser</Button></div></div>}
          {tab === 'paiements' && !canViewRecovery && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="font-medium text-slate-700">Disponible prochainement</p><p className="mt-1 text-sm text-slate-500">Cette section sera reliée à son module dédié.</p></div>}
          {tab === 'interventions' && <InterventionLinks interventions={clientInterventions} isLoading={interventionsLoading} error={Boolean(interventionsError)} />}
          {tab === 'devis' && <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><p className="font-medium text-slate-700">Disponible prochainement</p><p className="mt-1 text-sm text-slate-500">Cette section sera reliée à son module dédié.</p></div>}
        </div>
      </Card>
      <Modal open={editing} onClose={() => setEditing(false)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title="Modifier le client" className="w-[min(100%-2rem,56rem)]">
        {editing && <ClientForm initial={currentClient} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(false)} onSave={(values) => void saveChanges(values)} />}
      </Modal>
    </>
  )
}
