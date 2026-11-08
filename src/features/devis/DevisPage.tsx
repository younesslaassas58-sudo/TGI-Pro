import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Clipboard, FilePlus2, FileText, Link2, Pencil, RefreshCw, Send, X } from 'lucide-react'
import { Button, Card, Input, Modal, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArticlePicker } from '@/features/catalogue/ArticlePicker'
import { articleUnitLabels } from '@/features/catalogue/types'
import { useCatalogue } from '@/features/catalogue/useCatalogue'
import { ClientPicker } from '@/features/clients/ClientPicker'
import { useClients } from '@/features/clients/useClients'
import { calculateCommercialTotals, calculateQuoteStatistics } from '@/features/commercial/calculations'
import { toCommercialDocument } from '@/features/commercial/toDocumentModel'
import type { CommercialLine, PartySnapshot } from '@/features/commercial/types'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { useToast } from '@/hooks/useToast'
import { useAutosaveDevis, useChangeDevisStatus, useCreateDevis, useDevis, useReviseDevis, useShareDevis } from './useDevis'
import { useConvertDevisToCommande } from '@/features/commandes/useCommandes'
import { quoteStatusLabels, type Quote, type QuoteInput } from './types'

const money = (cents: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(cents / 100)
const today = () => new Date().toISOString().slice(0, 10)

function clientSnapshot(clients: ReturnType<typeof useClients>['data'], id: string): PartySnapshot | undefined {
  const client = clients?.find((item) => item.id === id)
  if (!client) return undefined
  return {
    id: client.id,
    name: client.raisonSociale,
    address: client.adresse,
    city: client.ville,
    ice: client.ice,
    phone: client.telephones[0] ?? '',
    email: client.email,
  }
}

function blankLine(): CommercialLine {
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

function QuoteEditor({ quote, initialClientId = '', onClose, onCreated }: {
  quote?: Quote
  initialClientId?: string
  onClose: () => void
  onCreated: (quote: Quote) => void
}) {
  const { data: clients = [] } = useClients()
  const { data: articles = [] } = useCatalogue()
  const create = useCreateDevis()
  const autosave = useAutosaveDevis()
  const autosaveQuote = autosave.mutateAsync
  const toast = useToast()
  const [clientId, setClientId] = useState(quote?.client.id ?? initialClientId)
  const [lines, setLines] = useState<CommercialLine[]>(quote?.lines ?? [blankLine()])
  const [issueDate, setIssueDate] = useState(quote?.issueDate ?? today())
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? '')
  const [notes, setNotes] = useState(quote?.notes ?? '')
  const [conditions, setConditions] = useState(quote?.conditions ?? '')
  const [current, setCurrent] = useState(quote)
  const [saveMessage, setSaveMessage] = useState(quote ? 'Modifications enregistrées' : '')
  const [errorMessage, setErrorMessage] = useState('')
  const input = useMemo<QuoteInput | undefined>(() => {
    const client = clientSnapshot(clients, clientId)
    if (!client || !lines.length || lines.some((line) => !line.designation.trim())) return undefined
    return { client, lines, issueDate, validUntil, notes, conditions }
  }, [clients, clientId, lines, issueDate, validUntil, notes, conditions])

  useEffect(() => {
    if (!current || !input || current.status !== 'draft') return
    const changed = JSON.stringify({
      client: current.client, lines: current.lines, issueDate: current.issueDate,
      validUntil: current.validUntil, notes: current.notes, conditions: current.conditions,
    }) !== JSON.stringify(input)
    if (!changed) return
    const timer = window.setTimeout(() => {
      setSaveMessage('Enregistrement en cours…')
      void autosaveQuote({ quote: current, input }).then((updated) => {
        setCurrent(updated)
        setSaveMessage('Enregistré automatiquement')
        setErrorMessage('')
      }).catch(() => {
        setSaveMessage('')
        setErrorMessage('Enregistrement automatique impossible. Vérifiez votre connexion et réessayez.')
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [current, input, autosaveQuote])

  async function saveNew() {
    if (!input) {
      setErrorMessage('Sélectionnez un client et renseignez la désignation de chaque ligne.')
      return
    }
    try {
      const created = await create.mutateAsync(input)
      setCurrent(created)
      onCreated(created)
      toast.success(`Devis ${created.number} créé.`)
    } catch {
      setErrorMessage('Impossible de créer le devis.')
    }
  }

  function updateLine(id: string, patch: Partial<CommercialLine>) {
    setLines((items) => items.map((line) => line.id === id ? { ...line, ...patch } : line))
  }

  const totals = calculateCommercialTotals(lines)
  const readOnly = current !== undefined && current.status !== 'draft'
  return (
    <div className="max-h-[78vh] space-y-4 overflow-y-auto">
      <div>
        <p className="mb-1 text-sm font-medium">Client</p>
        <ClientPicker value={clientId} onChange={setClientId} disabled={readOnly} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Date du devis<Input type="date" value={issueDate} disabled={readOnly} onChange={(event) => setIssueDate(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">Valable jusqu’au<Input type="date" value={validUntil} disabled={readOnly} onChange={(event) => setValidUntil(event.currentTarget.value)} /></label>
      </div>
      <div className="space-y-3">
        <h3 className="font-semibold">Lignes du devis</h3>
        {lines.map((line) => (
          <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-6" key={line.id}>
            <div className="sm:col-span-2"><ArticlePicker value={line.articleId ?? ''} disabled={readOnly} onChange={(id) => {
              const article = articles.find((item) => item.id === id)
              updateLine(line.id, article
                ? { articleId: id, reference: article.reference, designation: article.designation, description: article.description, unit: articleUnitLabels[article.unite], unitPriceCents: article.prixVenteCents, vatPercent: article.tauxTva }
                : { articleId: undefined })
            }} /></div>
            <Input className="sm:col-span-2" aria-label="Désignation" placeholder="Désignation" value={line.designation} disabled={readOnly} onChange={(event) => updateLine(line.id, { designation: event.currentTarget.value })} />
            <Input aria-label="Quantité" type="number" min="0.001" step="0.001" value={line.quantity} disabled={readOnly} onChange={(event) => updateLine(line.id, { quantity: Number(event.currentTarget.value) || 0 })} />
            <Input aria-label="Prix unitaire HT en MAD" type="number" min="0" step="0.01" value={(line.unitPriceCents / 100).toFixed(2)} disabled={readOnly} onChange={(event) => updateLine(line.id, { unitPriceCents: Math.max(0, Math.round(Number(event.currentTarget.value) * 100)) })} />
            <Input aria-label="TVA en pourcentage" type="number" min="0" max="100" step="0.1" value={line.vatPercent} disabled={readOnly} onChange={(event) => updateLine(line.id, { vatPercent: Number(event.currentTarget.value) || 0 })} />
            {!readOnly && <Button type="button" variant="ghost" aria-label="Retirer la ligne" onClick={() => setLines((items) => items.filter((item) => item.id !== line.id))}><X size={15} /></Button>}
          </div>
        ))}
        {!readOnly && <Button type="button" size="sm" variant="outline" onClick={() => setLines((items) => [...items, blankLine()])}><FilePlus2 size={15} /> Ajouter une ligne</Button>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Notes<Textarea value={notes} disabled={readOnly} onChange={(event) => setNotes(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">Conditions<Textarea value={conditions} disabled={readOnly} onChange={(event) => setConditions(event.currentTarget.value)} /></label>
      </div>
      <Card className="flex flex-wrap justify-between gap-2 p-3 text-sm">
        <span>Total HT : <strong>{money(totals.totalHTCents)}</strong></span>
        <span>TVA : <strong>{money(totals.totalVATCents)}</strong></span>
        <span>Total TTC : <strong>{money(totals.totalTTCCents)}</strong></span>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500" role="status">{errorMessage || saveMessage}</span>
        <div className="flex gap-2">
          {!current && <Button type="button" loading={create.isPending} disabled={!input} onClick={() => void saveNew()}>Créer le brouillon</Button>}
          {current && <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>}
        </div>
      </div>
    </div>
  )
}

export function DevisPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialClientId = searchParams.get('clientId') ?? ''
  const { settings } = useCompanySettings()
  const { data = [], isLoading, error } = useDevis()
  const changeStatus = useChangeDevisStatus()
  const revise = useReviseDevis()
  const share = useShareDevis()
  const convert = useConvertDevisToCommande()
  const toast = useToast()
  const [editing, setEditing] = useState<Quote | null | undefined>(initialClientId ? null : undefined)
  const [query, setQuery] = useState('')
  const filtered = data.filter((quote) => `${quote.number} ${quote.client.name} ${quote.client.city} ${quote.status}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  const stats = calculateQuoteStatistics(data.map((quote) => ({ status: quote.status, totalTTCCents: quote.totals.totalTTCCents })))
  const expiredStatuses = Object.entries(stats.byStatus).map(([status, value]) => `${quoteStatusLabels[status as Quote['status']]} : ${value.count}`)
  const urlForShare = (quote: Quote) => quote.shareToken ? `${window.location.origin}/devis/public/${quote.shareToken}` : ''

  function generateDocument(quote: Quote) {
    navigate('/documents/editor', {
      state: {
        document: toCommercialDocument({
          type: 'devis',
          number: quote.number,
          date: quote.issueDate,
          title: `Devis ${quote.number}`,
          issuer: settings,
          recipient: quote.client,
          lines: quote.lines,
          notes: quote.notes,
          conditions: quote.conditions,
        }),
      },
    })
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try { await action(); toast.success(success) } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Opération impossible.')
    }
  }

  async function shareQuote(quote: Quote) {
    await run(async () => {
      const url = await share.mutateAsync(quote)
      await navigator.clipboard.writeText(url)
    }, 'Lien de partage copié.')
  }

  return (
    <>
      <PageHeader title="Devis" description="Préparez vos propositions, suivez leur cycle de vie et consultez les révisions." action={<Button onClick={() => setEditing(null)}><FilePlus2 size={16} /> Nouveau devis</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-slate-500">Devis</p><p className="text-xl font-bold">{stats.count}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Montant total</p><p className="text-xl font-bold">{money(stats.totalCents)}</p></Card>
        <Card className="p-4"><p className="text-sm text-slate-500">Taux accepté / converti</p><p className="text-xl font-bold">{Math.round(stats.conversionRate * 100)} %</p><p className="mt-1 text-xs text-slate-500">{expiredStatuses.join(' · ') || 'Aucun statut'}</p></Card>
      </div>
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 p-4"><Input aria-label="Rechercher un devis" placeholder="Rechercher par numéro ou client…" value={query} onChange={(event) => setQuery(event.currentTarget.value)} /></div>
        {isLoading ? <p className="p-6 text-sm text-slate-500">Chargement des devis…</p> : error ? <p className="p-6 text-sm text-danger-700">Impossible de charger les devis.</p> : filtered.length === 0 ? <p className="p-6 text-sm text-slate-500">Aucun devis à afficher.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Numéro / révision</th><th className="p-3">Client</th><th className="p-3">Date</th><th className="p-3">Total TTC</th><th className="p-3">Statut</th><th className="p-3">Actions</th></tr></thead>
            <tbody>{filtered.map((quote) => (
              <tr className="border-t border-slate-100" key={quote.id}>
                <td className="p-3 font-medium">{quote.number}<span className="ml-2 text-xs text-slate-400">v{quote.revision}</span><div className="text-xs text-slate-500">{quote.history.length} événements</div></td>
                <td className="p-3">{quote.client.name}</td><td className="p-3">{quote.issueDate}</td><td className="p-3">{money(quote.totals.totalTTCCents)}</td><td className="p-3">{quoteStatusLabels[quote.status]}</td>
                <td className="p-3"><div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" aria-label="Générer le devis" onClick={() => generateDocument(quote)}><FileText size={14} /></Button>
                  {quote.status === 'draft' && <><Button size="sm" variant="outline" aria-label="Modifier le brouillon" onClick={() => setEditing(quote)}><Pencil size={14} /></Button><Button size="sm" aria-label="Marquer envoyé" onClick={() => void run(() => changeStatus.mutateAsync({ quote, status: 'sent' }), 'Devis marqué comme envoyé.')}><Send size={14} /></Button></>}
                  {quote.status === 'sent' && <><Button size="sm" variant="outline" onClick={() => void run(() => changeStatus.mutateAsync({ quote, status: 'accepted' }), 'Devis accepté.')}><Check size={14} /> Accepter</Button><Button size="sm" variant="outline" onClick={() => void run(() => changeStatus.mutateAsync({ quote, status: 'rejected' }), 'Devis refusé.')}><X size={14} /> Refuser</Button></>}
                  {quote.status === 'sent' && quote.validUntil && quote.validUntil < today() && <Button size="sm" variant="outline" onClick={() => void run(() => changeStatus.mutateAsync({ quote, status: 'expired' }), 'Devis marqué comme expiré.')}>Expirer</Button>}
                  {['sent', 'accepted'].includes(quote.status) && <><Button size="sm" variant="outline" onClick={() => void shareQuote(quote)}><Link2 size={14} /> Partager</Button><Button size="sm" variant="outline" onClick={() => void run(() => revise.mutateAsync(quote), 'Nouvelle révision créée.')}><RefreshCw size={14} /> Réviser</Button></>}
                  {quote.status === 'accepted' && <Button size="sm" onClick={() => void run(() => convert.mutateAsync(quote.id), 'Commande créée.')}>
                    <Clipboard size={14} /> Convertir
                  </Button>}
                  {quote.shareToken && <Button size="sm" variant="ghost" aria-label="Copier à nouveau le lien" onClick={() => void navigator.clipboard.writeText(urlForShare(quote)).then(() => toast.success('Lien copié.'))}><Link2 size={14} /></Button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <Card className="mt-4 p-4">
        <h2 className="mb-2 font-semibold">Historique et versions</h2>
        <div className="grid gap-3 md:grid-cols-2">{filtered.slice(0, 4).map((quote) => (
          <details className="rounded-xl border border-slate-200 p-3" key={quote.id}>
            <summary className="cursor-pointer text-sm font-medium">{quote.number} · révision {quote.revision} · {quote.client.name}</summary>
            <div className="mt-3 space-y-2 border-b border-slate-100 pb-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Versions envoyées</p>
              {quote.revisions.length ? quote.revisions.map((revision) => (
                <div className="rounded-lg bg-slate-50 p-2 text-xs" key={revision.revision}>
                  <p className="font-medium">Version {revision.revision} · {new Date(revision.capturedAt).toLocaleString('fr-MA')} · {money(revision.totals.totalTTCCents)} TTC</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">{revision.lines.map((line) => <li key={line.id}>{line.designation} · {line.quantity} {line.unit}</li>)}</ul>
                </div>
              )) : <p className="text-xs text-slate-500">Aucune version envoyée pour le moment.</p>}
            </div>
            <ol className="mt-3 space-y-2 text-xs text-slate-600">{[...quote.history].reverse().map((entry) => <li key={entry.id}><time>{new Date(entry.at).toLocaleString('fr-MA')}</time> · {entry.action} {entry.details && `— ${entry.details}`}</li>)}</ol>
          </details>
        ))}</div>
      </Card>
      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? `Éditer ${editing.number}` : 'Nouveau devis'} className="w-[min(100%-2rem,58rem)]">
        {editing !== undefined && <QuoteEditor key={editing?.id ?? 'new-quote'} quote={editing ?? undefined} initialClientId={initialClientId} onClose={() => setEditing(undefined)} onCreated={(created) => setEditing(created)} />}
      </Modal>
    </>
  )
}
