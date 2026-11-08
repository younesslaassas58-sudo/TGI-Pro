import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Download, Eye, Plus, Search, Wrench } from 'lucide-react'
import { Badge, Button, Card, Input, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { useClients } from '@/features/clients/useClients'
import { AscenseurForm } from './AscenseurForm'
import { type Ascenseur, type AscenseurInput } from './types'
import { useAscenseurs, useSaveAscenseur } from './useAscenseurs'

const stateNames: Record<Ascenseur['etatAppareil'], string> = {
  en_service: 'En service',
  en_panne: 'En panne',
  a_l_arret: 'À l’arrêt',
  en_modernisation: 'En modernisation',
}
const stateColors: Record<Ascenseur['etatAppareil'], string> = {
  en_service: 'bg-emerald-50 text-emerald-700',
  en_panne: 'bg-red-50 text-red-700',
  a_l_arret: 'bg-amber-50 text-amber-700',
  en_modernisation: 'bg-blue-50 text-blue-700',
}

export function ParcPage() {
  const [searchParams] = useSearchParams()
  const { data = [], isLoading, error } = useAscenseurs()
  const { data: clients = [] } = useClients()
  const save = useSaveAscenseur()
  const toast = useToast()
  const canCreate = usePermission('parc', 'creer')
  const canEdit = usePermission('parc', 'modifier')
  const [query, setQuery] = useState('')
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') ?? '')
  const [stateFilter, setStateFilter] = useState('')
  const [contractFilter, setContractFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [lateOnly, setLateOnly] = useState(false)
  const [sortKey, setSortKey] = useState<'code' | 'clientNomSnapshot' | 'marque'>('code')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Ascenseur | null | undefined>(undefined)
  const [editDirty, setEditDirty] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const cities = [...new Set(data.map((item) => item.villeSite).filter(Boolean))].sort()
  const filtered = useMemo(() => {
    const term = query.toLocaleLowerCase('fr')
    return data.filter((item) =>
      (!item.archive)
      && (!clientFilter || item.clientId === clientFilter)
      && (!stateFilter || item.etatAppareil === stateFilter)
      && (!contractFilter || item.contrat === contractFilter)
      && (!typeFilter || item.typeAppareil === typeFilter)
      && (!cityFilter || item.villeSite === cityFilter)
      && (!lateOnly || Boolean(item.prochaineVisite && item.prochaineVisite < today))
      && (!term || `${item.code} ${item.clientNomSnapshot} ${item.marque} ${item.numeroSerie} ${item.adresseSite}`.toLocaleLowerCase('fr').includes(term)),
    ).sort((a, b) => a[sortKey].localeCompare(b[sortKey], 'fr'))
  }, [data, query, clientFilter, stateFilter, contractFilter, typeFilter, cityFilter, lateOnly, sortKey, today])
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function saveElevator(input: AscenseurInput) {
    try {
      await save.mutateAsync({ input, ...(editing ? { existing: editing } : {}) })
      toast.success(editing ? 'Appareil mis à jour.' : 'Appareil ajouté au parc.')
      setEditing(undefined)
    } catch {
      toast.error('Impossible d’enregistrer cet appareil. Vérifiez vos droits et réessayez.')
    }
  }

  async function exportExcel() {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Parc')
      sheet.columns = [
        { header: 'Code', key: 'code', width: 18 },
        { header: 'Client', key: 'clientNomSnapshot', width: 30 },
        { header: 'Type', key: 'typeAppareil', width: 22 },
        { header: 'Marque', key: 'marque', width: 20 },
        { header: 'Modèle', key: 'modele', width: 22 },
        { header: 'N° série', key: 'numeroSerie', width: 22 },
        { header: 'Adresse', key: 'adresseSite', width: 36 },
        { header: 'Ville', key: 'villeSite', width: 20 },
        { header: 'État', key: 'etatAppareil', width: 20 },
        { header: 'Prochaine visite', key: 'prochaineVisite', width: 18 },
      ]
      filtered.forEach((item) => sheet.addRow(item))
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
      const saver = await import('file-saver')
      saver.saveAs(new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'parc-ascenseurs.xlsx')
    } catch {
      toast.error('L’export du parc a échoué.')
    }
  }

  return (
    <>
      <PageHeader title="Parc d’ascenseurs" description="Suivez les installations, contrats et prochaines visites." action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportExcel()}><Download size={16} /> Export Excel</Button>
          {canCreate && <Button onClick={() => setEditing(null)}><Plus size={16} /> Nouvel appareil</Button>}
        </div>
      } />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} placeholder="Code, client, marque, série, adresse…" className="pl-9" aria-label="Rechercher un appareil" /></label>
          <Select aria-label="Filtrer par client" value={clientFilter} onChange={(event) => { setClientFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les clients</option>{clients.filter((client) => !client.archive).map((client) => <option key={client.id} value={client.id}>{client.raisonSociale}</option>)}</Select>
          <Select aria-label="Filtrer par type" value={typeFilter} onChange={(event) => { setTypeFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les types</option><option value="ascenseur">Ascenseur</option><option value="monte_charge">Monte-charge</option><option value="monte_plat">Monte-plat</option><option value="monte_personne_pmr">Monte-personne PMR</option><option value="autre">Autre</option></Select>
          <Select aria-label="Filtrer par état" value={stateFilter} onChange={(event) => { setStateFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les états</option>{Object.entries(stateNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</Select>
          <Select aria-label="Filtrer par contrat" value={contractFilter} onChange={(event) => { setContractFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les contrats</option><option value="aucun">Aucun</option><option value="entretien_mensuel">Mensuel</option><option value="entretien_trimestriel">Trimestriel</option><option value="entretien_semestriel">Semestriel</option><option value="entretien_annuel">Annuel</option></Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2"><input type="checkbox" checked={lateOnly} onChange={(event) => { setLateOnly(event.currentTarget.checked); setPage(1) }} /> Visites en retard</label>
          <Select aria-label="Filtrer par ville" className="min-h-8 py-1 text-xs" value={cityFilter} onChange={(event) => { setCityFilter(event.currentTarget.value); setPage(1) }}><option value="">Toutes les villes</option>{cities.map((city) => <option key={city}>{city}</option>)}</Select>
          <label className="flex items-center gap-2">Trier par <Select className="min-h-8 py-1 text-xs" value={sortKey} onChange={(event) => { setSortKey(event.currentTarget.value as typeof sortKey); setPage(1) }}><option value="code">Code</option><option value="clientNomSnapshot">Client</option><option value="marque">Marque</option></Select></label>
          <span>{filtered.length} appareil(s)</span>
        </div>
      </Card>
      {isLoading ? <Card className="p-6"><Spinner label="Chargement du parc" /></Card>
        : error ? <Card className="p-6 text-sm text-danger-700">Impossible de charger le parc. Vérifiez votre connexion et vos droits.</Card>
        : filtered.length === 0 ? <Card className="p-12 text-center"><Wrench className="mx-auto text-slate-300" /><h2 className="mt-3 font-heading font-semibold text-navy-900">Aucun appareil trouvé</h2><p className="mt-1 text-sm text-slate-500">Ajustez les filtres ou ajoutez un appareil.</p></Card>
        : <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Code', 'Client / appareil', 'Site', 'Contrat', 'Prochaine visite', 'État', ''].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{pageRows.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-mono text-xs">{item.code}</td><td className="px-4 py-3"><Link to={`/parc/${item.id}`} className="font-semibold text-navy-900">{item.clientNomSnapshot}</Link><p className="text-xs text-slate-500">{item.marque} {item.modele}</p></td><td className="px-4 py-3">{item.adresseSite}<p className="text-xs text-slate-500">{item.villeSite}</p></td><td className="px-4 py-3 text-xs">{item.contrat.replaceAll('_', ' ')}</td><td className="px-4 py-3 text-xs">{item.prochaineVisite || '—'}{item.prochaineVisite && item.prochaineVisite < today && <span className="ml-1 inline-flex items-center gap-1 text-red-700"><AlertTriangle size={13} /> Retard</span>}</td><td className="px-4 py-3"><Badge className={stateColors[item.etatAppareil]}>{stateNames[item.etatAppareil]}</Badge></td><td className="px-4 py-3"><div className="flex gap-1"><Link className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" to={`/parc/${item.id}`} aria-label="Voir appareil"><Eye size={16} /></Link>{canEdit && <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>Modifier</Button>}</div></td></tr>)}</tbody></table></div>
          <div className="space-y-3 p-3 md:hidden">{pageRows.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between"><div><Link className="font-semibold text-navy-900" to={`/parc/${item.id}`}>{item.code} · {item.clientNomSnapshot}</Link><p className="mt-1 text-xs text-slate-500">{item.marque} {item.modele} · {item.villeSite}</p></div><Badge className={stateColors[item.etatAppareil]}>{stateNames[item.etatAppareil]}</Badge></div><p className="mt-2 text-xs text-slate-600">Prochaine visite : {item.prochaineVisite || 'Non planifiée'}</p></article>)}</div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"><span>Page {page} / {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Précédent</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((n) => n + 1)}>Suivant</Button></div></div>
        </Card>}
      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title={editing ? 'Modifier l’appareil' : 'Nouvel appareil'} className="w-[min(100%-2rem,56rem)]">
        {editing !== undefined && <AscenseurForm initial={editing ?? undefined} initialClientId={searchParams.get('client') ?? ''} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(undefined)} onSave={(values) => void saveElevator(values)} />}
      </Modal>
    </>
  )
}
