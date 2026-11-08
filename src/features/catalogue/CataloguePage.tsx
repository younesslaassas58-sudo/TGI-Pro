import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Archive, Download, FileUp, Plus, Search } from 'lucide-react'
import { Button, Card, Input, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useStockNiveaux } from '@/features/stock/useStock'
import { statutStock } from '@/features/stock/logic'
import { ArticleForm } from './ArticleForm'
import { articleSchema, articleUnitLabels, formatCents, type Article, type ArticleInput } from './types'
import { useArchiveArticle, useCatalogue, useSaveArticle } from './useCatalogue'

function parseCsv(text: string): string[][] {
  const content = text.replace(/^\uFEFF/, '')
  const firstLine = content.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [';', ',', '\t'].sort((a, b) =>
    [...firstLine].filter((character) => character === b).length
    - [...firstLine].filter((character) => character === a).length,
  )[0]
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
      } else if (character === '"') quoted = false
      else field += character
    } else if (character === '"' && field.length === 0) quoted = true
    else if (character === delimiter) {
      row.push(field)
      field = ''
    } else if (character === '\r' || character === '\n') {
      row.push(field)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      field = ''
      if (character === '\r' && content[index + 1] === '\n') index += 1
    } else field += character
  }
  if (quoted) throw new Error('Un champ CSV entre guillemets n’est pas terminé.')
  row.push(field)
  if (row.some((cell) => cell.trim())) rows.push(row)
  return rows
}

function normalizeHeader(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[^a-z0-9]/g, '')
}

function articleHeader(value: string): string {
  const key = normalizeHeader(value)
  const aliases: Record<string, string> = {
    code: 'code',
    reference: 'reference',
    designation: 'designation',
    article: 'designation',
    categorie: 'categorie',
    description: 'description',
    unite: 'unite',
    prixachatcentimes: 'prixAchatCents',
    prixachat: 'prixAchatCents',
    prixachatmad: 'prixAchatCents',
    prixventecentimes: 'prixVenteCents',
    prixvente: 'prixVenteCents',
    prixventemad: 'prixVenteCents',
    tauxtva: 'tauxTva',
    suivistock: 'suiviStock',
  }
  return aliases[key] ?? value.trim()
}

function cellText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value !== 'object' || value === null) return ''
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.flatMap((part) =>
      typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string' ? [part.text] : [],
    ).join('')
  }
  if ('result' in value) return cellText(value.result)
  return ''
}

async function readImportRows(file: File): Promise<string[][]> {
  if (file.name.toLocaleLowerCase('fr').endsWith('.csv')) return parseCsv(await file.text())
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) throw new Error('Le classeur ne contient aucune feuille.')
  const rows: string[][] = []
  sheet.eachRow((row) => {
    const values = row.values
    if (!Array.isArray(values)) return
    const cells = values.slice(1).map(cellText)
    if (cells.some((cell) => cell.trim())) rows.push(cells)
  })
  return rows
}

function csvCell(value: string | number | boolean): string {
  const text = String(value)
  return /[",\r\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function downloadCsv(articles: Article[]) {
  const headers = ['reference', 'designation', 'categorie', 'description', 'unite', 'prixAchatCents', 'prixVenteCents', 'tauxTva', 'suiviStock']
  const rows = articles.map((article) => [
    article.reference, article.designation, article.categorie, article.description, article.unite,
    article.prixAchatCents, article.prixVenteCents, article.tauxTva, article.suiviStock,
  ])
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'catalogue.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function CataloguePage() {
  const { data = [], isLoading, error } = useCatalogue()
  const { data: levels = [] } = useStockNiveaux()
  const save = useSaveArticle()
  const archive = useArchiveArticle()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Article>()
  const [importErrors, setImportErrors] = useState<string[]>([])
  const pageSize = 10
  const categories = [...new Set(data.map((article) => article.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('fr')
    return data.filter((article) =>
      (includeArchived || !article.archive)
      && (!category || article.categorie === category)
      && (!term || `${article.code} ${article.reference} ${article.designation} ${article.categorie}`.toLocaleLowerCase('fr').includes(term)),
    ).sort((a, b) => a.designation.localeCompare(b.designation, 'fr'))
  }, [data, query, category, includeArchived])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  async function saveArticle(input: ArticleInput) {
    const duplicate = data.find((article) => !article.archive && input.reference && article.reference.toLocaleLowerCase('fr') === input.reference.toLocaleLowerCase('fr') && article.id !== editing?.id)
    if (duplicate) {
      toast.error(`Cette référence est déjà utilisée par ${duplicate.code}.`)
      return
    }
    try {
      await save.mutateAsync({ input, ...(editing ? { existing: editing } : {}) })
      toast.success(editing ? 'Article mis à jour.' : 'Article créé.')
      setFormOpen(false)
      setEditing(undefined)
    } catch {
      toast.error('Impossible d’enregistrer l’article.')
    }
  }

  async function toggleArchive(article: Article) {
    try {
      await archive.mutateAsync({ article, archive: !article.archive })
      setPage(1)
      toast.success(article.archive ? 'Article restauré.' : 'Article archivé.')
    } catch {
      toast.error('Impossible de modifier l’archivage de cet article.')
    }
  }

  async function exportExcel() {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet('Catalogue')
      sheet.columns = [
        { header: 'Code', key: 'code', width: 18 },
        { header: 'Référence', key: 'reference', width: 22 },
        { header: 'Désignation', key: 'designation', width: 34 },
        { header: 'Catégorie', key: 'categorie', width: 22 },
        { header: 'Unité', key: 'unite', width: 16 },
        { header: 'Prix achat (centimes)', key: 'prixAchatCents', width: 22 },
        { header: 'Prix vente (centimes)', key: 'prixVenteCents', width: 22 },
        { header: 'TVA (%)', key: 'tauxTva', width: 12 },
      ]
      filtered.forEach((article) => sheet.addRow(article))
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
      const saver = await import('file-saver')
      saver.saveAs(new Blob([await workbook.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'catalogue.xlsx')
    } catch {
      toast.error('L’export Excel du catalogue a échoué.')
    }
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const errors: string[] = []
    try {
      const rows = await readImportRows(file)
      const headers = (rows.shift() ?? []).map(articleHeader)
      const imported: ArticleInput[] = []
      const references = new Set(data.filter((article) => article.reference).map((article) => article.reference.toLocaleLowerCase('fr')))
      rows.forEach((row, index) => {
        const values = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? '']))
        const parsed = articleSchema.omit({
          id: true, code: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true,
        }).safeParse({
          reference: values.reference ?? '',
          designation: values.designation ?? '',
          categorie: values.categorie ?? '',
          description: values.description ?? '',
          unite: values.unite || 'piece',
          prixAchatCents: Number(values.prixAchatCents || 0),
          prixVenteCents: Number(values.prixVenteCents || 0),
          tauxTva: Number(values.tauxTva || 0),
          suiviStock: (values.suiviStock ?? '').toLowerCase() === 'true',
          archive: false,
        })
        if (!parsed.success) {
          errors.push(`Ligne ${index + 2} : ${parsed.error.issues[0]?.message ?? 'données invalides'}`)
          return
        }
        const reference = parsed.data.reference.toLocaleLowerCase('fr')
        if (reference && references.has(reference)) {
          errors.push(`Ligne ${index + 2} : la référence « ${parsed.data.reference} » existe déjà.`)
          return
        }
        if (reference) references.add(reference)
        imported.push(parsed.data)
      })
      for (const input of imported) await save.mutateAsync({ input })
      setImportErrors(errors)
      toast.success(`${imported.length} article(s) importé(s).`)
      if (errors.length) toast.error(`${errors.length} ligne(s) ignorée(s) : consultez le détail.`)
    } catch {
      setImportErrors(['Le fichier Excel ou CSV est illisible ou son format est incorrect.'])
      toast.error('Impossible de lire ce fichier Excel ou CSV.')
    }
  }

  return (
    <>
      <PageHeader title="Catalogue" description="Gérez les articles, unités et tarifs. Les prix sont enregistrés en centimes." action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv(filtered)}><Download size={16} /> CSV</Button>
          <Button variant="outline" onClick={() => void exportExcel()}><Download size={16} /> Excel</Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}><FileUp size={16} /> Importer Excel / CSV</Button>
          <input ref={fileInput} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void importCsv(event)} />
          <Button onClick={() => { setEditing(undefined); setFormOpen(true) }}><Plus size={16} /> Nouvel article</Button>
        </div>
      } />
      {importErrors.length > 0 && <Card className="mb-4 p-4"><div className="flex items-start justify-between gap-3"><strong className="text-sm">Lignes ignorées à l’import</strong><Button size="sm" variant="ghost" onClick={() => setImportErrors([])}>Fermer</Button></div><ul className="mt-2 max-h-32 list-inside list-disc overflow-auto text-xs text-danger-700">{importErrors.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul></Card>}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="relative lg:col-span-2"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => { setQuery(event.currentTarget.value); setPage(1) }} placeholder="Code, référence, désignation…" className="pl-9" aria-label="Rechercher un article" /></label>
          <Select aria-label="Filtrer par catégorie" value={category} onChange={(event) => { setCategory(event.currentTarget.value); setPage(1) }}><option value="">Toutes les catégories</option>{categories.map((name) => <option key={name}>{name}</option>)}</Select>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.currentTarget.checked); setPage(1) }} /> Inclure les articles archivés</label>
      </Card>
      <Card className="overflow-hidden">
        {isLoading ? <div className="p-8"><Spinner label="Chargement du catalogue" /></div>
          : error ? <p className="p-6 text-sm text-danger-700">Impossible de charger le catalogue.</p>
            : filtered.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Aucun article trouvé.</p>
              : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Article</th><th className="px-4 py-3">Catégorie</th><th className="px-4 py-3">Unité</th><th className="px-4 py-3 text-right">Prix achat</th><th className="px-4 py-3 text-right">Prix vente</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{visible.map((article) => <tr key={article.id} className={article.archive ? 'bg-slate-50/70 text-slate-500' : ''}>
                  <td className="px-4 py-3"><strong className="block text-navy-900">{article.designation}</strong><span className="text-xs text-slate-500">{article.code}{article.reference ? ` · ${article.reference}` : ''}</span>{article.suiviStock && <small className="mt-1 block text-slate-500">Stock disponible : {levels.filter((level) => level.articleId === article.id).reduce((sum, level) => sum + level.quantite, 0)} · {statutStock(article, levels.filter((level) => level.articleId === article.id).reduce((sum, level) => sum + level.quantite, 0))}</small>}</td>
                  <td className="px-4 py-3">{article.categorie || '—'}</td><td className="px-4 py-3">{articleUnitLabels[article.unite]}</td>
                  <td className="px-4 py-3 text-right">{formatCents(article.prixAchatCents)}</td><td className="px-4 py-3 text-right">{formatCents(article.prixVenteCents)}</td>
                  <td className="px-4 py-3">{article.archive ? 'Archivé' : article.suiviStock ? 'Suivi stock' : 'Actif'}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={() => { setEditing(article); setFormOpen(true) }}>Modifier</Button><Button size="sm" variant="ghost" aria-label={article.archive ? 'Restaurer l’article' : 'Archiver l’article'} onClick={() => void toggleArchive(article)}><Archive size={15} /></Button></div></td>
                </tr>)}</tbody>
              </table></div>}
      </Card>
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>{filtered.length} article(s)</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</Button><span>{page} / {pageCount}</span><Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Suivant</Button></div></div>
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Modifier l’article' : 'Nouvel article'} className="w-[min(100%-2rem,48rem)]">
        {formOpen && <ArticleForm key={editing?.id ?? 'new'} initial={editing} busy={save.isPending} onCancel={() => setFormOpen(false)} onSave={(input) => void saveArticle(input)} />}
      </Modal>
    </>
  )
}
