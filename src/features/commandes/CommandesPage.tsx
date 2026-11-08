import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, Ban, FilePlus2, FileText, Search } from 'lucide-react'
import { Button, Card, Input, Modal, Select, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArticlePicker } from '@/features/catalogue/ArticlePicker'
import { articleUnitLabels, type Article } from '@/features/catalogue/types'
import { useCatalogue } from '@/features/catalogue/useCatalogue'
import { ClientPicker } from '@/features/clients/ClientPicker'
import { useClients } from '@/features/clients/useClients'
import { toCommercialDocument } from '@/features/commercial/toDocumentModel'
import { useToast } from '@/hooks/useToast'
import { FournisseurPicker } from '@/features/fournisseurs/FournisseurPicker'
import { useFournisseurs } from '@/features/fournisseurs/useFournisseurs'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { useDepots } from '@/features/stock/useStock'
import type { CommercialLine } from '@/features/commercial/types'
import { useCommandes, useCreateCommande, useRecordSupplierReceipt, useUpdateCommandeStatus } from './useCommandes'
import { orderStatusLabels, type Order, type OrderInput } from './types'

const money = (cents: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(cents / 100)
const today = () => new Date().toISOString().slice(0, 10)

function newLine(): CommercialLine {
  return {
    id: crypto.randomUUID(),
    designation: '',
    reference: '',
    description: '',
    quantity: 1,
    unit: 'pièce',
    unitPriceCents: 0,
    discountPercent: 0,
    vatPercent: 20,
  }
}

function prefilledLines(articles: Article[], quantities: Record<string, number>): CommercialLine[] {
  return Object.entries(quantities).flatMap(([articleId, quantity]) => {
    const article = articles.find((item) => item.id === articleId && item.suiviStock && !item.archive)
    return article && quantity > 0 ? [{
      ...newLine(),
      articleId: article.id,
      reference: article.reference,
      designation: article.designation,
      description: article.description,
      quantity,
      unit: articleUnitLabels[article.unite],
      unitPriceCents: article.prixAchatCents,
      vatPercent: article.tauxTva,
    }] : []
  })
}

function OrderForm({
  onClose,
  onCreated,
  initialClientId = '',
  initialSupplierId = '',
  initialKind,
  initialArticleQuantities = {},
  catalogueArticles,
}: {
  onClose: () => void
  onCreated: () => void
  initialClientId?: string
  initialSupplierId?: string
  initialKind?: OrderInput['kind']
  initialArticleQuantities?: Record<string, number>
  catalogueArticles: Article[]
}) {
  const { data: clients = [] } = useClients()
  const { data: fournisseurs = [] } = useFournisseurs()
  const create = useCreateCommande()
  const toast = useToast()
  const [kind, setKind] = useState<OrderInput['kind']>(initialKind ?? (initialSupplierId ? 'fournisseur' : 'client'))
  const [clientId, setClientId] = useState(initialClientId)
  const [fournisseurId, setFournisseurId] = useState(initialSupplierId)
  const [orderDate, setOrderDate] = useState(today())
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<CommercialLine[]>(() => {
    const initialLines = prefilledLines(catalogueArticles, initialArticleQuantities)
    return initialLines.length ? initialLines : [newLine()]
  })
  const [error, setError] = useState('')

  function updateLine(id: string, patch: Partial<CommercialLine>) {
    setLines((items) => items.map((line) => line.id === id ? { ...line, ...patch } : line))
  }

  async function submit() {
    const selectedClient = kind === 'client' ? clients.find((client) => client.id === clientId) : undefined
    const selectedFournisseur = kind === 'fournisseur'
      ? fournisseurs.find((item) => item.id === fournisseurId)
      : undefined
    const party = selectedClient
      ? {
          id: selectedClient.id,
          name: selectedClient.raisonSociale,
          address: selectedClient.adresse,
          city: selectedClient.ville,
          ice: selectedClient.ice,
          phone: selectedClient.telephones[0] ?? '',
          email: selectedClient.email,
        }
      : selectedFournisseur
        ? {
            id: selectedFournisseur.id,
            name: selectedFournisseur.raisonSociale,
            address: selectedFournisseur.adresse,
            city: selectedFournisseur.ville,
            ice: selectedFournisseur.ice,
            phone: selectedFournisseur.telephone,
            email: selectedFournisseur.email,
          }
        : { name: '', address: '', city: '', ice: '', phone: '', email: '' }
    if (!party.name || (kind === 'fournisseur' && !selectedFournisseur) || lines.some((line) => !line.designation.trim() || line.quantity <= 0)) {
      setError('Saisissez un client ou fournisseur ainsi qu’une désignation et une quantité valides.')
      return
    }
    const input: OrderInput = {
      kind,
      party,
      lines,
      orderDate,
      expectedDate,
      notes,
    }
    try {
      await create.mutateAsync(input)
      toast.success('Bon de commande créé.')
      onCreated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de créer le bon de commande.')
    }
  }

  return (
    <div className="max-h-[78vh] space-y-4 overflow-y-auto">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Type de commande<Select value={kind} onChange={(event) => setKind(event.currentTarget.value as OrderInput['kind'])}>
          <option value="client">Commande client</option><option value="fournisseur">Commande fournisseur</option>
        </Select></label>
        {kind === 'client'
          ? <div className="sm:col-span-2"><p className="mb-1 text-sm font-medium">Client</p><ClientPicker value={clientId} onChange={setClientId} /></div>
          : <div className="sm:col-span-2"><p className="mb-1 text-sm font-medium">Fournisseur</p><FournisseurPicker value={fournisseurId} onChange={setFournisseurId} /></div>}
        <label className="space-y-1 text-sm">Date de commande<Input type="date" value={orderDate} onChange={(event) => setOrderDate(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">Date prévue<Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.currentTarget.value)} /></label>
      </div>
      <section className="space-y-2">
        <h3 className="font-semibold">Articles commandés</h3>
        {lines.map((line) => <div key={line.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><ArticlePicker value={line.articleId ?? ''} onChange={(id) => {
            const article = catalogueArticles.find((item) => item.id === id)
            updateLine(line.id, article
              ? { articleId: id, reference: article.reference, designation: article.designation, description: article.description, unit: articleUnitLabels[article.unite], unitPriceCents: article.prixVenteCents, vatPercent: article.tauxTva }
              : { articleId: undefined })
          }} /></div>
          <Input className="sm:col-span-2" aria-label="Désignation" placeholder="Désignation personnalisée" value={line.designation} onChange={(event) => updateLine(line.id, { designation: event.currentTarget.value })} />
          <Input aria-label="Quantité commandée" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.currentTarget.value) || 0 })} />
          <Input aria-label="Prix unitaire HT en MAD" type="number" min="0" step="0.01" value={(line.unitPriceCents / 100).toFixed(2)} onChange={(event) => updateLine(line.id, { unitPriceCents: Math.max(0, Math.round(Number(event.currentTarget.value) * 100)) })} />
        </div>)}
        <Button size="sm" variant="outline" type="button" onClick={() => setLines((items) => [...items, newLine()])}><FilePlus2 size={15} /> Ajouter une ligne</Button>
      </section>
      <label className="block space-y-1 text-sm">Notes<Textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} /></label>
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fermer</Button><Button loading={create.isPending} onClick={() => void submit()}>Créer la commande</Button></div>
    </div>
  )
}

function SupplierReceiptForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const record = useRecordSupplierReceipt()
  const toast = useToast()
  const { data: depots = [] } = useDepots()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [depotId, setDepotId] = useState('')
  const [receiptId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  async function submit() {
    try {
      await record.mutateAsync({ orderId: order.id, quantities, depotId, receiptId })
      toast.success('Réception fournisseur enregistrée.')
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Réception impossible.')
    }
  }
  return <div className="space-y-4">
    <p className="text-sm text-slate-600">{order.number} · {order.party.name}</p>
    <label className="block space-y-1 text-sm">Dépôt de réception
      <Select value={depotId} onChange={(event) => setDepotId(event.currentTarget.value)}>
        <option value="">Sélectionner un dépôt</option>
        {depots.filter((depot) => depot.actif && !depot.archive).map((depot) => <option value={depot.id} key={depot.id}>{depot.code} · {depot.nom}</option>)}
      </Select>
    </label>
    {order.lines.map((line) => <label key={line.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm">
      <span>{line.designation}<small className="block text-slate-500">Reste : {Math.max(0, line.orderedQuantity - line.fulfilledQuantity)} {line.unit}</small></span>
      <Input aria-label={`Quantité reçue : ${line.designation}`} type="number" min="0" max={line.orderedQuantity - line.fulfilledQuantity} step="0.001" value={quantities[line.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: Number(event.currentTarget.value) || 0 }))} />
    </label>)}
    {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Annuler</Button><Button loading={record.isPending} onClick={() => void submit()}>Enregistrer la réception</Button></div>
  </div>
}

export function CommandesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialClientId = searchParams.get('clientId') ?? ''
  const initialSupplierId = searchParams.get('supplierId') ?? ''
  const initialKind = searchParams.get('kind') === 'fournisseur' ? 'fournisseur' : undefined
  const initialArticleQuantities = useMemo(() => Object.fromEntries(searchParams.getAll('stockArticle').flatMap((value) => {
    const separator = value.lastIndexOf(':')
    if (separator <= 0) return []
    const articleId = value.slice(0, separator)
    const quantity = Number(value.slice(separator + 1))
    return articleId && Number.isFinite(quantity) && quantity > 0 ? [[articleId, quantity]] : []
  })), [searchParams])
  const { settings } = useCompanySettings()
  const { data: catalogueArticles = [], isLoading: catalogueLoading } = useCatalogue()
  const { data = [], isLoading, error } = useCommandes()
  const updateStatus = useUpdateCommandeStatus()
  const toast = useToast()
  const [creating, setCreating] = useState(Boolean(initialClientId || initialSupplierId || initialKind))
  const [receiving, setReceiving] = useState<Order | undefined>()
  const [filter, setFilter] = useState('')
  const [kind, setKind] = useState('')
  const filtered = useMemo(() => data.filter((order) => {
    if (kind && order.kind !== kind) return false
    return `${order.number} ${order.party.name} ${order.status}`.toLocaleLowerCase('fr').includes(filter.toLocaleLowerCase('fr'))
  }), [data, kind, filter])

  function generateDocument(order: Order) {
    navigate('/documents/editor', {
      state: {
        document: toCommercialDocument({
          type: 'commande',
          number: order.number,
          date: order.orderDate,
          title: `${order.kind === 'client' ? 'Bon de commande client' : 'Bon de commande fournisseur'} ${order.number}`,
          issuer: settings,
          recipient: order.party,
          lines: order.lines,
          notes: order.notes,
          references: order.sourceQuoteNumber ? `Devis d’origine : ${order.sourceQuoteNumber}` : '',
        }),
      },
    })
  }

  async function cancel(order: Order) {
    try {
      await updateStatus.mutateAsync({ order, status: 'cancelled' })
      toast.success('Commande annulée.')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Annulation impossible.')
    }
  }

  return <>
    <PageHeader title="Bons de commande" description="Suivez les commandes client et fournisseur, leurs conversions et leurs réceptions." action={<Button onClick={() => setCreating(true)}><FilePlus2 size={16} /> Nouvelle commande</Button>} />
    <Card className="overflow-hidden">
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_14rem]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><Input className="pl-9" placeholder="Rechercher un numéro ou tiers…" value={filter} onChange={(event) => setFilter(event.currentTarget.value)} /></label>
        <Select aria-label="Type de commande" value={kind} onChange={(event) => setKind(event.currentTarget.value)}><option value="">Tous les types</option><option value="client">Commandes client</option><option value="fournisseur">Commandes fournisseur</option></Select>
      </div>
      {isLoading ? <p className="p-6 text-sm text-slate-500">Chargement des commandes…</p> : error ? <p className="p-6 text-sm text-danger-700">Impossible de charger les commandes.</p> : !filtered.length ? <p className="p-6 text-sm text-slate-500">Aucune commande à afficher.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Numéro</th><th className="p-3">Type / tiers</th><th className="p-3">Date</th><th className="p-3">Avancement</th><th className="p-3">Total TTC</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{filtered.map((order) => {
            const ordered = order.lines.reduce((sum, line) => sum + line.orderedQuantity, 0)
            const fulfilled = order.lines.reduce((sum, line) => sum + line.fulfilledQuantity, 0)
            return <tr className="border-t border-slate-100" key={order.id}>
              <td className="p-3 font-medium">{order.number}{order.sourceQuoteNumber && <small className="block text-slate-500">Devis {order.sourceQuoteNumber}</small>}</td>
              <td className="p-3">{order.kind === 'client' ? 'Client' : 'Fournisseur'}<small className="block text-slate-500">{order.party.name}</small></td>
              <td className="p-3">{order.orderDate}</td><td className="p-3">{fulfilled} / {ordered}</td><td className="p-3">{money(order.totals.totalTTCCents)}</td><td className="p-3">{orderStatusLabels[order.status]}</td>
              <td className="p-3"><div className="flex gap-2">
                <Button size="sm" variant="ghost" aria-label="Générer le bon de commande" onClick={() => generateDocument(order)}><FileText size={14} /></Button>
                {order.kind === 'fournisseur' && ['ordered', 'partially_received'].includes(order.status) && <Button size="sm" variant="outline" onClick={() => setReceiving(order)}><ArrowDownToLine size={14} /> Réception</Button>}
                {['ordered', 'partially_received'].includes(order.status) && <Button size="sm" variant="danger" aria-label="Annuler la commande" onClick={() => void cancel(order)}><Ban size={14} /></Button>}
              </div></td>
            </tr>
          })}</tbody>
        </table></div>
      )}
    </Card>
    <Modal open={creating} onClose={() => setCreating(false)} title="Créer un bon de commande" className="w-[min(100%-2rem,56rem)]">
      {creating && !catalogueLoading && <OrderForm catalogueArticles={catalogueArticles} initialClientId={initialClientId} initialSupplierId={initialSupplierId} initialKind={initialKind} initialArticleQuantities={initialArticleQuantities} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </Modal>
    <Modal open={receiving !== undefined} onClose={() => setReceiving(undefined)} title="Réceptionner une commande">
      {receiving && <SupplierReceiptForm order={receiving} onClose={() => setReceiving(undefined)} />}
    </Modal>
  </>
}
