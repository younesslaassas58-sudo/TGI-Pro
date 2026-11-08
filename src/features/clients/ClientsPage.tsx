import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Download, Eye, FileUp, Plus, Search, UserRound } from 'lucide-react'
import { Button, Card, Input, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { ClientForm } from './ClientForm'
import { clientSchema, clientStatusLabels, clientTypeLabels, emptyClientInput, type Client, type ClientInput } from './types'
import { useArchiveClient, useClients, useCommercials, useSaveClient } from './useClients'

const statusClass: Record<Client['statut'], string> = {
  prospect: 'bg-amber-50 text-amber-700',
  actif: 'bg-emerald-50 text-emerald-700',
  inactif: 'bg-slate-100 text-slate-600',
}

function normalizeClientName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, '')
  const headerEnd = content.search(/[\r\n]/)
  const header = headerEnd < 0 ? content : content.slice(0, headerEnd)
  const delimiters = [',', ';', '\t'] as const
  const delimiter = delimiters.reduce((best, candidate) => {
    const count = [...header].filter((character) => character === candidate).length
    return count > best.count ? { delimiter: candidate, count } : best
  }, { delimiter: ',', count: -1 }).delimiter
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index]
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\r' || character === '\n') {
      row.push(field)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      field = ''
      if (character === '\r' && content[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('Le fichier CSV contient un champ entre guillemets non terminé.')
  row.push(field)
  if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

export function ClientsPage() {
  const { data = [], isLoading, error } = useClients()
  const { data: commercials = [] } = useCommercials()
  const save = useSaveClient()
  const archive = useArchiveClient()
  const toast = useToast()
  const canCreate = usePermission('clients', 'creer')
  const canEdit = usePermission('clients', 'modifier')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [city, setCity] = useState('')
  const [commercial, setCommercial] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [sortKey, setSortKey] = useState<'raisonSociale' | 'code' | 'ville'>('raisonSociale')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Client | null | undefined>(undefined)
  const [editDirty, setEditDirty] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importRows, setImportRows] = useState<ClientInput[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const pageSize = 10

  const cities = [...new Set(data.map((client) => client.ville).filter(Boolean))].sort()
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr')
    return data.filter((client) => {
      if (!includeArchived && client.archive) return false
      if (type && client.typeClient !== type) return false
      if (status && client.statut !== status) return false
      if (city && client.ville !== city) return false
      if (commercial && client.commercialResponsableUid !== commercial) return false
      if (!term) return true
      return [
        client.raisonSociale, client.code, client.ice, client.ville,
        client.telephones.join(' '), client.email,
      ].join(' ').toLocaleLowerCase('fr').includes(term)
    }).sort((a, b) => a[sortKey].localeCompare(b[sortKey], 'fr'))
  }, [data, query, type, status, city, commercial, includeArchived, sortKey])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function saveClient(input: ClientInput) {
    const newName = normalizeClientName(input.raisonSociale)
    const matching = data.find((client) =>
      (!client.archive && input.ice && client.ice === input.ice && client.id !== editing?.id)
      || (!client.archive && client.id !== editing?.id && (() => {
        const existingName = normalizeClientName(client.raisonSociale)
        return existingName === newName || (Math.min(existingName.length, newName.length) >= 6 && (existingName.includes(newName) || newName.includes(existingName)))
      })()),
    )
    if (matching && !window.confirm(`Un client proche existe déjà (${matching.code} · ${matching.raisonSociale}). Enregistrer quand même ?`)) return
    try {
      await save.mutateAsync({ input, ...(editing ? { existing: editing } : {}) })
      toast.success(editing ? 'Client mis à jour.' : 'Client créé.')
      setEditing(undefined)
    } catch {
      toast.error('Impossible d’enregistrer le client. Vérifiez vos droits et réessayez.')
    }
  }

  async function toggleArchive(client: Client) {
    try {
      await archive.mutateAsync({ client, archive: !client.archive })
      toast.success(client.archive ? 'Client restauré.' : 'Client archivé.')
    } catch {
      toast.error('Impossible de modifier l’archivage du client.')
    }
  }

  async function exportExcel() {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Clients')
      sheet.columns = [
        { header: 'Code', key: 'code', width: 18 },
        { header: 'Client', key: 'raisonSociale', width: 36 },
        { header: 'Type', key: 'typeClient', width: 20 },
        { header: 'ICE', key: 'ice', width: 20 },
        { header: 'Ville', key: 'ville', width: 22 },
        { header: 'Téléphones', key: 'telephones', width: 28 },
        { header: 'E-mail', key: 'email', width: 32 },
        { header: 'Statut', key: 'statut', width: 16 },
      ]
      filtered.forEach((client) => sheet.addRow({ ...client, telephones: client.telephones.filter(Boolean).join(' · ') }))
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
      const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const saver = await import('file-saver')
      saver.saveAs(blob, 'clients.xlsx')
    } catch {
      toast.error('L’export des clients a échoué.')
    }
  }

  async function downloadTemplate() {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Clients')
      sheet.addRow(['raisonSociale', 'typeClient', 'ice', 'rc', 'identifiantFiscal', 'adresse', 'ville', 'quartier', 'codePostal', 'telephone', 'email', 'siteWeb', 'modePaiementHabituel', 'delaiPaiementJours', 'statut'])
      sheet.addRow(['Société exemple', 'societe', '', '', '', 'Adresse', 'Casablanca', '', '', '+212522000000', 'contact@exemple.ma', '', 'Virement', 30, 'prospect'])
      const blob = new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const saver = await import('file-saver')
      saver.saveAs(blob, 'modele-import-clients.xlsx')
    } catch {
      toast.error('Impossible de créer le modèle d’import.')
    }
  }

  async function readImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setImportErrors([])
    setImportedCount(null)
    try {
      let rows: unknown[][] = []
      if (file.name.toLowerCase().endsWith('.csv')) {
        rows = parseCsv(await file.text())
      } else {
        const ExcelJS = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const sheet = workbook.worksheets[0]
        rows = sheet ? sheet.getSheetValues().slice(1).map((row) => Array.isArray(row) ? row.slice(1) : []) : []
      }
      const headers = rows[0]?.map((value) => String(value ?? '').trim()) ?? []
      const valid: ClientInput[] = []
      const errors: string[] = []
      rows.slice(1).forEach((row, index) => {
        const item = Object.fromEntries(headers.map((header, i) => {
          const value = row[i]
          return [header, typeof value === 'string' ? value : String(value ?? '')]
        }))
        const parsed = clientSchema.omit({ id: true, code: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true }).safeParse({
          ...emptyClientInput,
          ...item,
          delaiPaiementJours: Number(item.delaiPaiementJours ?? 30),
          telephones: String(item.telephone ?? '').trim() ? [String(item.telephone)] : [''],
          contacts: [],
          archive: false,
        })
        if (parsed.success) valid.push(parsed.data)
        else errors.push(`Ligne ${index + 2} : ${parsed.error.issues[0]?.message ?? 'données invalides'}`)
      })
      setImportRows(valid)
      setImportErrors(errors)
      setImportOpen(true)
    } catch {
      toast.error('Fichier illisible. Utilisez le modèle Excel ou un fichier CSV.')
    }
  }

  async function importValidRows() {
    let imported = 0
    const seen = new Set(data.flatMap((client) => [
      ...(client.ice ? [`ice:${client.ice}`] : []),
      `name:${normalizeClientName(client.raisonSociale)}`,
    ]))
    for (const input of importRows) {
      const iceKey = input.ice ? `ice:${input.ice}` : ''
      const nameKey = `name:${normalizeClientName(input.raisonSociale)}`
      if ((iceKey && seen.has(iceKey)) || seen.has(nameKey)) {
        setImportErrors((previous) => [...previous, `Doublon ignoré : ${input.raisonSociale}`])
        continue
      }
      try {
        await save.mutateAsync({ input })
        if (iceKey) seen.add(iceKey)
        seen.add(nameKey)
        imported += 1
      } catch {
        setImportErrors((previous) => [...previous, `Échec d’import : ${input.raisonSociale}`])
      }
    }
    if (imported > 0) toast.success(`${imported} client(s) importé(s).`)
    else toast.error('Aucun nouveau client n’a été importé.')
    setImportedCount(imported)
    setImportRows([])
  }

  return (
    <>
      <PageHeader title="Clients" description="Gérez les comptes clients et leurs coordonnées." action={
        <div className="flex flex-wrap gap-2">
          {canCreate && <><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FileUp size={16} /> Importer<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => void readImport(event)} /></label><Button variant="outline" onClick={() => void downloadTemplate()}><Download size={16} /> Modèle</Button><Button onClick={() => setEditing(null)}><Plus size={16} /> Nouveau client</Button></>}
          <Button variant="outline" onClick={() => void exportExcel()}><Download size={16} /> Export Excel</Button>
        </div>
      } />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} placeholder="Nom, code, ICE, ville, téléphone…" className="pl-9" aria-label="Rechercher un client" /></label>
          <Select aria-label="Filtrer par type" value={type} onChange={(event) => { setType(event.currentTarget.value); setPage(1) }}><option value="">Tous les types</option><option value="societe">Société</option><option value="particulier">Particulier</option><option value="syndic">Syndic</option><option value="administration">Administration</option></Select>
          <Select aria-label="Filtrer par statut" value={status} onChange={(event) => { setStatus(event.currentTarget.value); setPage(1) }}><option value="">Tous les statuts</option><option value="prospect">Prospect</option><option value="actif">Actif</option><option value="inactif">Inactif</option></Select>
          <Select aria-label="Filtrer par ville" value={city} onChange={(event) => { setCity(event.currentTarget.value); setPage(1) }}><option value="">Toutes les villes</option>{cities.map((name) => <option key={name}>{name}</option>)}</Select>
          <Select aria-label="Filtrer par commercial" value={commercial} onChange={(event) => { setCommercial(event.currentTarget.value); setPage(1) }}><option value="">Tous les commerciaux</option>{commercials.map((user) => <option key={user.uid} value={user.uid}>{user.displayName}</option>)}</Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <label className="flex items-center gap-2"><input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.currentTarget.checked); setPage(1) }} /> Inclure les clients archivés</label>
          <label className="flex items-center gap-2">Trier par <Select className="min-h-8 py-1 text-xs" value={sortKey} onChange={(event) => { setSortKey(event.currentTarget.value as typeof sortKey); setPage(1) }}><option value="raisonSociale">Nom</option><option value="code">Code</option><option value="ville">Ville</option></Select></label>
          <span>{filtered.length} résultat(s)</span>
        </div>
      </Card>
      {isLoading ? <Card className="space-y-3 p-5"><Spinner label="Chargement des clients" />{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</Card>
        : error ? <Card className="p-6 text-sm text-danger-700">Impossible de charger les clients. Vérifiez votre connexion et vos droits.</Card>
        : filtered.length === 0 ? <Card className="p-12 text-center"><UserRound className="mx-auto text-slate-300" /><h2 className="mt-3 font-heading font-semibold text-navy-900">Aucun client trouvé</h2><p className="mt-1 text-sm text-slate-500">Modifiez vos filtres ou créez une nouvelle fiche client.</p></Card>
        : <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Code', 'Client', 'Type', 'Ville', 'Téléphone', 'Statut', ''].map((head) => <th className="px-4 py-3" key={head}>{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{pageRows.map((client) => <tr key={client.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-mono text-xs text-slate-500">{client.code}</td><td className="px-4 py-3"><Link to={`/clients/${client.id}`} className="font-semibold text-navy-900 hover:text-gold-700">{client.raisonSociale}</Link><p className="text-xs text-slate-500">{client.ice}</p></td><td className="px-4 py-3">{clientTypeLabels[client.typeClient]}</td><td className="px-4 py-3">{client.ville || '—'}</td><td className="px-4 py-3">{client.telephones.find(Boolean) || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[client.statut]}`}>{client.archive ? 'Archivé' : clientStatusLabels[client.statut]}</span></td><td className="px-4 py-3"><div className="flex gap-1"><Link className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Voir le client" to={`/clients/${client.id}`}><Eye size={16} /></Link>{canEdit && <Button variant="ghost" size="sm" aria-label={client.archive ? 'Restaurer le client' : 'Archiver le client'} loading={archive.isPending} onClick={() => void toggleArchive(client)}><Archive size={15} /></Button>}{canEdit && !client.archive && <Button variant="ghost" size="sm" onClick={() => setEditing(client)}>Modifier</Button>}</div></td></tr>)}</tbody></table></div>
          <div className="space-y-3 p-3 md:hidden">{pageRows.map((client) => <article key={client.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><div><Link to={`/clients/${client.id}`} className="font-semibold text-navy-900">{client.raisonSociale}</Link><p className="mt-1 font-mono text-xs text-slate-500">{client.code} · {client.ville}</p></div><span className={`rounded-full px-2 py-1 text-xs ${statusClass[client.statut]}`}>{client.archive ? 'Archivé' : clientStatusLabels[client.statut]}</span></div><p className="mt-2 text-sm text-slate-600">{client.telephones.find(Boolean) || client.email || 'Coordonnées non renseignées'}</p><div className="mt-3 flex gap-2"><Link className="text-sm text-navy-700" to={`/clients/${client.id}`}>Consulter</Link>{canEdit && <button className="text-sm text-slate-500" onClick={() => setEditing(client)}>Modifier</button>}</div></article>)}</div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm"><span>Page {page} / {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Suivant</Button></div></div>
        </Card>}
      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} beforeClose={() => !editDirty || window.confirm('Les modifications non enregistrées seront perdues. Continuer ?')} title={editing ? 'Modifier le client' : 'Nouveau client'} className="w-[min(100%-2rem,56rem)]">
        {editing !== undefined && <ClientForm initial={editing ?? undefined} busy={save.isPending} onDirtyChange={setEditDirty} onCancel={() => setEditing(undefined)} onSave={(values) => void saveClient(values)} />}
      </Modal>
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importer des clients">
        <div className="space-y-4 text-sm">
          <p>Choisissez un fichier .xlsx ou .csv structuré selon le modèle. Les lignes invalides ou en doublon sont ignorées.</p>
          <Button variant="outline" onClick={() => void downloadTemplate()}><Download size={15} /> Télécharger le modèle Excel</Button>
          <label className="block text-xs font-medium">Sélectionner un fichier<input type="file" accept=".xlsx,.csv" className="mt-2 block w-full text-sm" onChange={(event) => { void readImport(event); setImportOpen(false) }} /></label>
          {importRows.length > 0 && <><p>{importRows.length} ligne(s) valide(s) prêtes à importer.</p><div className="max-h-36 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs">{importRows.slice(0, 5).map((row, index) => <p key={`${row.raisonSociale}-${index}`}>{row.raisonSociale} · {row.ville || 'Ville non renseignée'} · {row.ice || 'Sans ICE'}</p>)}{importRows.length > 5 && <p className="mt-1 text-slate-500">et {importRows.length - 5} autres…</p>}</div><Button loading={save.isPending} onClick={() => void importValidRows()}>Importer les lignes valides</Button></>}
          {importedCount !== null && <p className="font-medium text-emerald-700">{importedCount} client(s) importé(s).</p>}
          {importErrors.length > 0 && <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-danger-700">{importErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul>}
        </div>
      </Modal>
    </>
  )
}
