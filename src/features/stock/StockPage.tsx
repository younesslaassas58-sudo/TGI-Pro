import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, FileSpreadsheet, Plus, Warehouse } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Badge, Button, Card, Input, Modal, Select, Spinner, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import { useCatalogue } from '@/features/catalogue/useCatalogue'
import { TechnicienPicker } from '@/features/techniciens/TechnicienPicker'
import { useTechniciens } from '@/features/techniciens/useTechniciens'
import { useFournisseurs } from '@/features/fournisseurs/useFournisseurs'
import { formatMoney } from '@/lib/format'
import { getNextNumber } from '@/features/documents/getNextNumber'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import {
  getTechnicianDepot,
  useApplyStockMovement,
  useCancelStockMovement,
  useCreateDepot,
  useCreateInventory,
  useDepots,
  useInventaires,
  useMouvements,
  useSaveInventoryCounts,
  useStockCouts,
  useStockNiveaux,
  useUpdateDepot,
  useValidateInventory,
} from './useStock'
import { calculerEcartInventaire, historiqueQuantites, statutStock, valoriserStock } from './logic'
import { createInventoryFicha, createReplenishmentFicha, createStockArticleFicha, createStockMovementDocument, createStockStatement } from './documentModels'
import type { Article } from '@/features/catalogue/types'
import type { Depot, Mouvement, MouvementInput } from './types'

type StockArticleRow = Omit<Pick<Article, 'id' | 'code' | 'designation' | 'categorie' | 'unite' | 'suiviStock' | 'archive' | 'seuilAlerte' | 'seuilMax' | 'prixAchatCents' | 'fournisseurPrincipalId'>, 'unite'> & { unite: string }

const sectionLabels: Record<string, string> = {
  tableau: 'Tableau de bord',
  articles: 'Articles',
  mouvements: 'Mouvements',
  depots: 'Dépôts',
  inventaires: 'Inventaires',
}
const statusNames = { ok: 'En stock', bas: 'Stock bas', rupture: 'Rupture', surstock: 'Surstock' }
const statusColors = { ok: 'success', bas: 'warning', rupture: 'danger', surstock: 'default' } as const
const movementNames: Record<Mouvement['type'], string> = {
  entree_achat: 'Entrée achat',
  entree_retour: 'Entrée retour',
  entree_manuelle: 'Entrée manuelle',
  sortie_livraison: 'Sortie livraison',
  sortie_intervention: 'Sortie intervention',
  sortie_manuelle: 'Sortie manuelle',
  transfert: 'Transfert',
  ajustement_inventaire: 'Ajustement inventaire',
  casse_perte: 'Casse / perte',
}

function StockMovementModal({
  articles,
  depots,
  onClose,
  onSave,
  initialType = 'entree_manuelle',
  initialSourceId = '',
}: {
  articles: Article[]
  depots: Array<{ id: string; nom: string }>
  onClose: () => void
  onSave: (input: MouvementInput) => Promise<void>
  initialType?: MouvementInput['type']
  initialSourceId?: string
}) {
  const [type, setType] = useState<MouvementInput['type']>(initialType)
  const [articleId, setArticleId] = useState('')
  const [sourceId, setSourceId] = useState(initialSourceId)
  const [destinationId, setDestinationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [motif, setMotif] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const selectedArticle = articles.find((item) => item.id === articleId)
  const inbound = ['entree_achat', 'entree_manuelle', 'entree_retour'].includes(type)
  const { data: selectedLevels = [] } = useStockNiveaux(inbound ? destinationId : sourceId, Boolean(inbound ? destinationId : sourceId))
  const availableQuantity = selectedLevels.find((level) => level.articleId === articleId)?.quantite ?? 0

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedArticle) return toast.error('Sélectionnez un article suivi en stock.')
    if (!inbound && Number(quantity) > availableQuantity) {
      return toast.error(`Stock insuffisant : disponible ${availableQuantity} ${selectedArticle.unite}.`)
    }
    setBusy(true)
    try {
      await onSave({
        type,
        articleId,
        quantite: Number(quantity),
        ...(inbound ? { depotDestinationId: destinationId, coutUnitaireHT: Math.round(Number(cost || selectedArticle.prixAchatCents / 100) * 100) } : {}),
        ...(!inbound ? { depotSourceId: sourceId } : {}),
        ...(type === 'transfert' ? { depotDestinationId: destinationId } : {}),
        motif,
      })
      onClose()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Le mouvement n’a pas pu être enregistré.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal open onClose={onClose} title="Nouveau mouvement">
    <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      <label className="block space-y-1 text-sm">Type<Select value={type} onChange={(event) => setType(event.currentTarget.value as MouvementInput['type'])}>
        <option value="entree_manuelle">Entrée manuelle</option><option value="entree_retour">Entrée retour</option>
        <option value="sortie_manuelle">Sortie manuelle</option><option value="transfert">Transfert</option><option value="casse_perte">Casse / perte</option>
      </Select></label>
      <label className="block space-y-1 text-sm">Article suivi<Select required value={articleId} onChange={(event) => setArticleId(event.currentTarget.value)}>
        <option value="">Sélectionner un article</option>{articles.filter((item) => item.suiviStock && !item.archive).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.designation}</option>)}
      </Select></label>
      <label className="block space-y-1 text-sm">Quantité<Input required min="0.001" step="0.001" type="number" value={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} /></label>
      {inbound && <label className="block space-y-1 text-sm">Dépôt de destination<Select required value={destinationId} onChange={(event) => setDestinationId(event.currentTarget.value)}><option value="">Sélectionner un dépôt</option>{depots.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select></label>}
      {!inbound && <label className="block space-y-1 text-sm">Dépôt source<Select required disabled={Boolean(initialSourceId)} value={sourceId} onChange={(event) => setSourceId(event.currentTarget.value)}><option value="">Sélectionner un dépôt</option>{depots.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select></label>}
      {!inbound && sourceId && <p className="text-xs text-slate-500">Disponible dans ce dépôt : {availableQuantity} {selectedArticle?.unite ?? ''}</p>}
      {type === 'transfert' && <label className="block space-y-1 text-sm">Dépôt de destination<Select required value={destinationId} onChange={(event) => setDestinationId(event.currentTarget.value)}><option value="">Sélectionner un dépôt</option>{depots.filter((item) => item.id !== sourceId).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select></label>}
      {inbound && <label className="block space-y-1 text-sm">Coût unitaire HT (MAD)<Input min="0" step="0.01" type="number" value={cost} onChange={(event) => setCost(event.currentTarget.value)} /></label>}
      <label className="block space-y-1 text-sm">Motif {['sortie_manuelle', 'casse_perte'].includes(type) ? '(obligatoire)' : ''}<Input required={['sortie_manuelle', 'casse_perte'].includes(type)} value={motif} onChange={(event) => setMotif(event.currentTarget.value)} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy}>Enregistrer</Button></div>
    </form>
  </Modal>
}

export function StockPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { articleId, depotId, inventoryId } = useParams()
  const toast = useToast()
  const profile = useAuth((state) => state.profile)
  const user = useAuth((state) => state.user)
  const isDirector = profile?.role === 'directeur'
  const isTechnician = profile?.role === 'technicien'
  const canCreate = usePermission('stock', 'creer')
  const section = location.pathname.split('/')[2] ?? 'tableau'
  const { data: depots = [], isLoading: depotsLoading } = useDepots()
  const { settings } = useCompanySettings()
  const ownDepot = isTechnician && user ? getTechnicianDepot(depots, user.uid) : undefined
  const { data: allLevels = [], isLoading: levelsLoading, error: levelsError } = useStockNiveaux(ownDepot?.id, !isTechnician || Boolean(ownDepot))
  const { data: articles = [], isLoading: articlesLoading, error: articlesError } = useCatalogue(!isTechnician)
  const { data: technicians = [] } = useTechniciens()
  const { data: suppliers = [] } = useFournisseurs(!isTechnician)
  const { data: costs = [] } = useStockCouts(!isTechnician)
  const { data: movements = [], error: movementsError } = useMouvements(!isTechnician)
  const { data: inventories = [] } = useInventaires(isDirector)
  const apply = useApplyStockMovement()
  const cancel = useCancelStockMovement()
  const createDepot = useCreateDepot()
  const updateDepot = useUpdateDepot()
  const createInventory = useCreateInventory()
  const saveCounts = useSaveInventoryCounts()
  const validateInventory = useValidateInventory()
  const costMap = new Map(costs.map((item) => [item.articleId, item]))
  const depotMap = new Map(depots.map((item) => [item.id, item]))
  const [search, setSearch] = useState('')
  const [movementModal, setMovementModal] = useState(false)
  const [depotModal, setDepotModal] = useState(false)
  const [newDepotName, setNewDepotName] = useState('')
  const [newDepotType, setNewDepotType] = useState<'principal' | 'vehicule' | 'chantier' | 'autre'>('principal')
  const [depotTechnicianId, setDepotTechnicianId] = useState('')
  const [editingDepot, setEditingDepot] = useState<Depot>()
  const [editDepotName, setEditDepotName] = useState('')
  const [editDepotAddress, setEditDepotAddress] = useState('')
  const [editDepotType, setEditDepotType] = useState<Depot['type']>('principal')
  const [editDepotTechnicianId, setEditDepotTechnicianId] = useState('')
  const [inventoryDepot, setInventoryDepot] = useState('')
  const [countValues, setCountValues] = useState<Record<string, string>>({})
  const [activeInventory, setActiveInventory] = useState<string>()
  const [articleCategory, setArticleCategory] = useState('')
  const [articleDepot, setArticleDepot] = useState('')
  const [articleStatus, setArticleStatus] = useState('')
  const [articleSupplier, setArticleSupplier] = useState('')
  const [articleSort, setArticleSort] = useState<'name' | 'quantity' | 'value'>('name')
  const [articlePage, setArticlePage] = useState(1)
  const [movementType, setMovementType] = useState('')
  const [movementDepot, setMovementDepot] = useState('')
  const [movementArticle, setMovementArticle] = useState('')
  const [movementAuthor, setMovementAuthor] = useState('')
  const [movementFrom, setMovementFrom] = useState('')
  const [movementTo, setMovementTo] = useState('')
  const [movementPage, setMovementPage] = useState(1)
  const [movementSort, setMovementSort] = useState<'date' | 'article' | 'quantity'>('date')
  const pageSize = 10
  const trackedArticles: StockArticleRow[] = isTechnician
    ? allLevels.map((item) => ({
        id: item.articleId,
        code: item.codeSnapshot,
        designation: item.designationSnapshot,
        categorie: '',
        unite: item.unite,
        suiviStock: true,
        archive: false,
        prixAchatCents: 0,
      }))
    : articles.filter((item) => item.suiviStock && !item.archive)
  const quantities = new Map<string, number>()
  for (const level of allLevels) quantities.set(level.articleId, (quantities.get(level.articleId) ?? 0) + level.quantite)
  const visibleLevels = allLevels
  const filteredArticles = trackedArticles.filter((item) =>
    `${item.code} ${item.designation} ${item.categorie}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  )
  const articleCategories = [...new Set(trackedArticles.map((article) => article.categorie).filter(Boolean))]
  const matchingArticles = filteredArticles.filter((article) => {
    const quantity = articleDepot
      ? allLevels.find((level) => level.articleId === article.id && level.depotId === articleDepot)?.quantite ?? 0
      : quantities.get(article.id) ?? 0
    const status = statutStock(article, quantity)
    return (!articleCategory || article.categorie === articleCategory)
      && (!articleStatus || status === articleStatus)
      && (!articleSupplier || article.fournisseurPrincipalId === articleSupplier)
  }).sort((left, right) => {
    if (articleSort === 'quantity') return (quantities.get(right.id) ?? 0) - (quantities.get(left.id) ?? 0)
    if (articleSort === 'value') {
      return (quantities.get(right.id) ?? 0) * (costMap.get(right.id)?.pmpHT ?? 0)
        - (quantities.get(left.id) ?? 0) * (costMap.get(left.id)?.pmpHT ?? 0)
    }
    return left.designation.localeCompare(right.designation, 'fr')
  })
  const articlePageCount = Math.max(1, Math.ceil(matchingArticles.length / pageSize))
  const visibleArticles = matchingArticles.slice((articlePage - 1) * pageSize, articlePage * pageSize)
  const valueTotal = trackedArticles.reduce((sum, item) => {
    const cost = costMap.get(item.id)?.pmpHT
    return sum + (!isTechnician && cost !== undefined ? valoriserStock(quantities.get(item.id) ?? 0, cost) : 0)
  }, 0)
  const alertArticles = trackedArticles.filter((item) => ['bas', 'rupture'].includes(statutStock(item, quantities.get(item.id) ?? 0)))
  const selectedArticle = articleId ? trackedArticles.find((item) => item.id === articleId) : undefined
  const selectedDepot = depotId ? depotMap.get(depotId) : undefined
  const scopedLevels = (id: string) => visibleLevels.filter((item) => item.articleId === id)
  const currentInventory = inventories.find((item) => item.id === (activeInventory ?? inventoryId))
  const matchingMovements = [...movements].filter((item) => {
    const matchesText = `${item.numero} ${item.codeSnapshot} ${item.designationSnapshot} ${item.auteurNom} ${item.motif}`
      .toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))
    const matchesDepot = !movementDepot || item.depotSourceId === movementDepot || item.depotDestinationId === movementDepot
    return matchesText
      && (!movementType || item.type === movementType)
      && matchesDepot
      && (!movementArticle || item.articleId === movementArticle)
      && (!movementAuthor || item.auteurNom.toLocaleLowerCase('fr').includes(movementAuthor.toLocaleLowerCase('fr')))
      && (!movementFrom || item.date >= movementFrom)
      && (!movementTo || item.date <= movementTo)
  }).sort((left, right) => movementSort === 'article'
    ? left.designationSnapshot.localeCompare(right.designationSnapshot, 'fr')
    : movementSort === 'quantity'
      ? right.quantite - left.quantite
      : right.createdAt.localeCompare(left.createdAt))
  const movementPageCount = Math.max(1, Math.ceil(matchingMovements.length / pageSize))
  const visibleMovements = matchingMovements.slice((movementPage - 1) * pageSize, movementPage * pageSize)
  const topArticles = [...trackedArticles]
    .map((article) => ({ article, value: (quantities.get(article.id) ?? 0) * (costMap.get(article.id)?.pmpHT ?? 0) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5)
  const replenishmentGroups = new Map<string, StockArticleRow[]>()
  for (const article of alertArticles) {
    const supplier = article.fournisseurPrincipalId || ''
    replenishmentGroups.set(supplier, [...(replenishmentGroups.get(supplier) ?? []), article])
  }

  async function saveDepot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newDepotName.trim()) return toast.error('Saisissez le nom du dépôt.')
    const technician = technicians.find((item) => item.id === depotTechnicianId)
    if (newDepotType === 'vehicule' && !technician?.uidCompte) return toast.error('Associez un technicien disposant d’un compte utilisateur au dépôt véhicule.')
    try {
      await createDepot.mutateAsync({
        nom: newDepotName.trim(),
        type: newDepotType,
        ...(newDepotType === 'vehicule' && technician?.uidCompte ? { technicienId: technician.id, technicienUid: technician.uidCompte } : {}),
        adresse: '',
        actif: true,
        archive: false,
      })
      setDepotModal(false)
      setNewDepotName('')
      setDepotTechnicianId('')
      toast.success('Dépôt créé.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de créer le dépôt.')
    }
  }

  async function saveDepotChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingDepot || !editDepotName.trim()) return toast.error('Saisissez le nom du dépôt.')
    const technician = technicians.find((item) => item.id === editDepotTechnicianId)
    if (editDepotType === 'vehicule' && !technician?.uidCompte) return toast.error('Associez un technicien disposant d’un compte utilisateur au dépôt véhicule.')
    try {
      await updateDepot.mutateAsync({
        depot: editingDepot,
        changes: {
          nom: editDepotName.trim(),
          adresse: editDepotAddress.trim(),
          type: editDepotType,
          ...(editDepotType === 'vehicule' && technician?.uidCompte ? { technicienId: technician.id, technicienUid: technician.uidCompte } : {}),
        },
      })
      setEditingDepot(undefined)
      toast.success('Dépôt mis à jour.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de modifier le dépôt.')
    }
  }

  async function startInventory() {
    if (!inventoryDepot) return toast.error('Sélectionnez un dépôt.')
    const lines = trackedArticles.map((article) => {
      const level = allLevels.find((item) => item.articleId === article.id && item.depotId === inventoryDepot)
      return {
        articleId: article.id,
        codeSnapshot: article.code,
        designationSnapshot: article.designation,
        unite: article.unite,
        quantiteTheorique: level?.quantite ?? 0,
        coutUnitaire: costMap.get(article.id)?.pmpHT ?? 0,
        commentaire: '',
      }
    })
    try {
      const result = await createInventory.mutateAsync({ depotId: inventoryDepot, lignes: lines, notes: '' })
      setActiveInventory(result.id)
      toast.success(`Inventaire ${result.numero} créé.`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de créer l’inventaire.')
    }
  }

  async function saveInventory() {
    if (!currentInventory) return
    try {
      const lines = currentInventory.lignes.map((line) => ({
        ...line,
        quantiteComptee: Number(countValues[line.articleId] ?? line.quantiteTheorique),
        ...calculerEcartInventaire(line.quantiteTheorique, Number(countValues[line.articleId] ?? line.quantiteTheorique), line.coutUnitaire),
      }))
      await saveCounts.mutateAsync({ inventory: currentInventory, lignes: lines })
      toast.success('Comptage enregistré.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le comptage.')
    }
  }

  async function validateCurrentInventory() {
    if (!currentInventory || profile?.role !== 'directeur') return
    const inventory = {
      ...currentInventory,
      lignes: currentInventory.lignes.map((line) => ({
        ...line,
        quantiteComptee: Number(countValues[line.articleId] ?? line.quantiteComptee ?? line.quantiteTheorique),
      })),
    }
    if (!window.confirm(`Valider l’inventaire ${inventory.numero} et appliquer ses écarts au stock ?`)) return
    try {
      await validateInventory.mutateAsync(inventory)
      setActiveInventory(undefined)
      toast.success('Inventaire validé et mouvements d’ajustement créés.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'La validation de l’inventaire a échoué.')
    }
  }

  async function exportExcel(name: string, rows: Array<Array<string | number>>) {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(name)
    if (rows.length) {
      sheet.addRows(rows)
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } }
    }
    try {
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([buffer]), `${name.toLocaleLowerCase('fr').replaceAll(' ', '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? `L’export a échoué : ${error.message}` : 'L’export Excel a échoué.')
    }
  }

  function openStockSheet(depotFilter?: string) {
    const document = createStockStatement(
      settings,
      articles,
      allLevels,
      depots,
      new Map(costs.map((item) => [item.articleId, item.pmpHT])),
      `STK-${new Date().toISOString().slice(0, 10)}`,
      depotFilter,
      !isTechnician,
    )
    navigate('/documents/editor', { state: { document } })
  }

  async function openMovementDocument(item: Mouvement) {
    try {
      const numberingType = item.type.startsWith('entree')
        ? 'bon_entree'
        : item.type === 'transfert' ? 'bon_transfert' : 'bon_sortie'
      const number = await getNextNumber(numberingType)
      navigate('/documents/editor', {
        state: {
          document: createStockMovementDocument(
            settings,
            item,
            depotMap.get(item.depotSourceId ?? ''),
            depotMap.get(item.depotDestinationId ?? ''),
            number,
          ),
        },
      })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de générer le bon de mouvement.')
    }
  }

  function openReplenishmentDocument(supplierId: string, items: StockArticleRow[]) {
    const supplier = suppliers.find((item) => item.id === supplierId)
    const rows = items.flatMap((item) => {
      const article = articles.find((candidate) => candidate.id === item.id)
      const quantity = Math.max(0, (item.seuilMax ?? item.seuilAlerte ?? 0) - (quantities.get(item.id) ?? 0))
      return article && quantity > 0 ? [{ article, quantity, pmp: costMap.get(item.id)?.pmpHT ?? 0 }] : []
    })
    navigate('/documents/editor', { state: { document: createReplenishmentFicha(settings, supplier?.raisonSociale ?? '', rows) } })
  }

  if ((depotsLoading || levelsLoading || articlesLoading) && !allLevels.length) {
    return <Card className="p-8"><Spinner label="Chargement du stock" /></Card>
  }

  if (section === 'inventaires' && !isDirector) {
    return <Card className="p-8 text-center"><h2 className="font-semibold">Accès réservé au directeur</h2><p className="mt-1 text-sm text-slate-500">La gestion des inventaires n’est pas disponible pour votre rôle.</p></Card>
  }

  if (articleId && selectedArticle) {
    const history = movements.filter((item) => item.articleId === articleId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const historyPoints = historiqueQuantites(
      scopedLevels(articleId).reduce((sum, level) => sum + level.quantite, 0),
      history.map((item) => ({ date: item.createdAt, type: item.type, ...(item.direction ? { direction: item.direction } : {}), quantite: item.quantite })),
    )
    const maxBalance = Math.max(1, ...historyPoints.map((point) => point.quantite))
    const chartPoints = historyPoints.map((point, index) => `${historyPoints.length < 2 ? 300 : index * 600 / (historyPoints.length - 1)},${110 - point.quantite * 100 / maxBalance}`).join(' ')
    return <><PageHeader title={selectedArticle.designation} description={`${selectedArticle.code} · ${selectedArticle.unite}`} action={<div className="flex gap-2"><Button variant="outline" onClick={() => navigate('/documents/editor', { state: { document: createStockArticleFicha(settings, selectedArticle, scopedLevels(articleId), depots, history, costMap.get(articleId)?.pmpHT ?? 0, !isTechnician) } })}>Générer la fiche</Button><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeftRight size={16} /> Retour au stock</Button></div>} />
      <div className="grid gap-4 md:grid-cols-2">{scopedLevels(articleId).map((level) => <Card key={level.id} className="p-5"><h2 className="font-semibold">{depotMap.get(level.depotId)?.nom ?? 'Dépôt'}</h2><p className="mt-2 text-2xl font-bold">{level.quantite} {level.unite}</p></Card>)}</div>
      {!isTechnician && <Card className="mt-4 p-5"><h2 className="font-semibold">Historique du stock</h2>{historyPoints.length > 0 && <svg viewBox="0 0 600 120" role="img" aria-label="Évolution des quantités en stock" className="my-4 h-32 w-full rounded-lg bg-slate-50"><polyline points={chartPoints} fill="none" stroke="#0B1F3A" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg>}{[...history].reverse().map((item) => <div key={item.id} className="flex justify-between border-b py-3 text-sm"><span>{item.date} · {item.numero} · {movementNames[item.type]} · {item.motif}</span><span>{item.quantite} · {formatMoney(item.pmpApres / 100)}</span></div>)}</Card>}
    </>
  }

  if (depotId && selectedDepot) {
    return <><PageHeader title={selectedDepot.nom} description={`${selectedDepot.code} · ${selectedDepot.type}`} action={<Button onClick={() => setMovementModal(true)}><ArrowLeftRight size={16} /> Transférer du stock</Button>} /><Card className="divide-y p-4">{visibleLevels.filter((item) => item.depotId === depotId).map((level) => <Link key={level.id} to={`/stock/articles/${level.articleId}`} className="flex justify-between py-3 text-sm"><span>{level.codeSnapshot} · {level.designationSnapshot}</span><strong>{level.quantite} {level.unite}</strong></Link>)}</Card>{movementModal && <StockMovementModal articles={articles.filter((item) => item.suiviStock)} depots={depots.filter((item) => item.actif && !item.archive)} initialType="transfert" initialSourceId={depotId} onClose={() => setMovementModal(false)} onSave={(input) => apply.mutateAsync({ ...input, type: 'transfert', depotSourceId: depotId })} />}</>
  }

  const title = isTechnician ? 'Mon stock' : sectionLabels[section] ?? 'Stock'
  return <>
    <PageHeader title={title} description={isTechnician ? 'Quantités disponibles dans votre dépôt véhicule.' : 'Suivi des articles, dépôts, mouvements et inventaires.'} action={<div className="flex flex-wrap gap-2">
      {!isTechnician && section === 'mouvements' && canCreate && <Button onClick={() => setMovementModal(true)}><Plus size={16} /> Mouvement</Button>}
      {isDirector && section === 'depots' && <Button onClick={() => setDepotModal(true)}><Plus size={16} /> Nouveau dépôt</Button>}
      {isDirector && section === 'inventaires' && <Button onClick={() => void startInventory()}><Plus size={16} /> Nouvel inventaire</Button>}
      {section === 'articles' && !isTechnician && <><Button variant="outline" onClick={() => void exportExcel('Etat stock', [['Code', 'Désignation', 'Catégorie', 'Quantité', 'Seuil', 'Statut', 'PMP HT (centimes)', 'Valeur HT (centimes)'], ...matchingArticles.map((article) => { const quantity = quantities.get(article.id) ?? 0; const pmp = costMap.get(article.id)?.pmpHT ?? 0; return [article.code, article.designation, article.categorie, quantity, article.seuilAlerte ?? '', statusNames[statutStock(article, quantity)], pmp, Math.round(quantity * pmp)] })])}><FileSpreadsheet size={16} /> Export Excel</Button><Button variant="outline" onClick={() => {
        const byCategory = new Map<string, number>()
        for (const article of matchingArticles) byCategory.set(article.categorie || 'Sans catégorie', (byCategory.get(article.categorie || 'Sans catégorie') ?? 0) + Math.round((quantities.get(article.id) ?? 0) * (costMap.get(article.id)?.pmpHT ?? 0)))
        void exportExcel('Valorisation catégorie', [['Catégorie', 'Valeur HT (centimes)'], ...[...byCategory].map(([category, value]) => [category, value])])
      }}><FileSpreadsheet size={16} /> Valorisation par catégorie</Button><Button variant="outline" onClick={() => openStockSheet()} >Fiche de stock</Button></>}
      {isTechnician && <Button variant="outline" onClick={() => openStockSheet(ownDepot?.id)}>Fiche de stock</Button>}
      {section === 'mouvements' && !isTechnician && <Button variant="outline" onClick={() => void exportExcel('Mouvements', [['Numéro', 'Date', 'Type', 'Code', 'Désignation', 'Quantité', 'Dépôt source', 'Dépôt destination', 'Auteur', 'Motif'], ...matchingMovements.map((item) => [item.numero, item.date, movementNames[item.type], item.codeSnapshot, item.designationSnapshot, item.quantite, depotMap.get(item.depotSourceId ?? '')?.nom ?? '', depotMap.get(item.depotDestinationId ?? '')?.nom ?? '', item.auteurNom, item.motif])])}><FileSpreadsheet size={16} /> Export Excel</Button>}
    </div>} />
    {!isTechnician && <nav aria-label="Sections du stock" className="mb-4 flex flex-wrap gap-2">
      {Object.entries(sectionLabels).filter(([key]) => key !== 'inventaires' || isDirector).map(([key, label]) => <Link key={key} to={key === 'tableau' ? '/stock' : `/stock/${key}`} className={`rounded-lg px-3 py-2 text-sm ${section === key ? 'bg-navy-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{label}</Link>)}
    </nav>}
    {(levelsError || articlesError || movementsError) && <Card className="mb-4 p-4 text-sm text-danger-700">Erreur de chargement des données de stock. Vérifiez vos accès et actualisez la page.</Card>}
    {isTechnician && !ownDepot && <Card className="p-8 text-center"><Warehouse className="mx-auto mb-2" /><h2 className="font-semibold">Aucun dépôt véhicule associé</h2><p className="text-sm text-slate-500">Contactez le directeur pour associer un dépôt à votre compte.</p></Card>}
    {!isTechnician && section === 'tableau' && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!isTechnician && <Card className="p-4"><p className="text-xs text-slate-500">Valeur totale du stock</p><p className="mt-2 text-xl font-bold">{formatMoney(valueTotal / 100)}</p></Card>}
        <Card className="p-4"><p className="text-xs text-slate-500">Articles suivis</p><p className="mt-2 text-xl font-bold">{trackedArticles.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Articles en alerte</p><p className="mt-2 text-xl font-bold">{alertArticles.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Articles en rupture</p><p className="mt-2 text-xl font-bold">{alertArticles.filter((item) => statutStock(item, quantities.get(item.id) ?? 0) === 'rupture').length}</p></Card>
      </div>
      {!depots.length && <Card className="mt-4 flex items-center justify-between p-5"><p>Aucun dépôt configuré. Créez le dépôt principal pour commencer.</p><Button onClick={() => setDepotModal(true)}>Créer un dépôt</Button></Card>}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">À réapprovisionner · regroupé par fournisseur</h2>
          {[...replenishmentGroups].map(([supplierId, items]) => {
            const params = new URLSearchParams({ kind: 'fournisseur' })
            if (supplierId) params.set('supplierId', supplierId)
            for (const article of items) {
              const quantity = Math.max(0, (article.seuilMax ?? article.seuilAlerte ?? 0) - (quantities.get(article.id) ?? 0))
              if (quantity > 0) params.append('stockArticle', `${article.id}:${quantity}`)
            }
            return <div key={supplierId || 'unassigned'} className="border-b py-3">
              <div className="flex items-center justify-between gap-2"><strong className="text-sm">{supplierId ? suppliers.find((supplier) => supplier.id === supplierId)?.raisonSociale ?? `Fournisseur ${supplierId}` : 'Fournisseur à définir'}</strong>
                <div className="flex flex-wrap gap-3"><Link className="text-sm text-navy-700 underline" to={`/commandes?${params.toString()}`}>Créer une commande pré-remplie</Link><button type="button" className="text-sm text-navy-700 underline" onClick={() => openReplenishmentDocument(supplierId, items)}>Générer la liste</button></div>
              </div>
              {items.map((article) => <p key={article.id} className="mt-1 text-xs text-slate-500">{article.code} · {article.designation} — disponible : {quantities.get(article.id) ?? 0}, seuil : {article.seuilAlerte ?? 0}</p>)}
            </div>
          })}
          {!alertArticles.length && <p className="py-4 text-sm text-slate-500">Aucune alerte de réapprovisionnement.</p>}
        </Card>
        <Card className="p-5"><h2 className="font-semibold">Top articles par valeur</h2>{topArticles.map(({ article, value }) => <div key={article.id} className="flex justify-between border-b py-3 text-sm"><span>{article.code} · {article.designation}</span><strong>{formatMoney(value / 100)}</strong></div>)}</Card>
        <Card className="p-5"><h2 className="font-semibold">Derniers mouvements</h2>{[...movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((item) => <div key={item.id} className="flex justify-between border-b py-3 text-sm"><span>{item.numero} · {item.designationSnapshot}<small className="block text-slate-500">{movementNames[item.type]} · {item.auteurNom}</small></span><strong>{item.quantite}</strong></div>)}</Card>
      </div>
    </>}
    {(isTechnician || section === 'articles') && <Card className="mt-4 p-4">
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input value={search} onChange={(event) => { setSearch(event.currentTarget.value); setArticlePage(1) }} placeholder="Rechercher un article…" />
        {!isTechnician && <>
          <Select aria-label="Filtrer par catégorie" value={articleCategory} onChange={(event) => { setArticleCategory(event.currentTarget.value); setArticlePage(1) }}><option value="">Toutes les catégories</option>{articleCategories.map((category) => <option key={category} value={category}>{category}</option>)}</Select>
          <Select aria-label="Filtrer par dépôt" value={articleDepot} onChange={(event) => { setArticleDepot(event.currentTarget.value); setArticlePage(1) }}><option value="">Tous les dépôts</option>{depots.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select>
          <Select aria-label="Filtrer par statut de stock" value={articleStatus} onChange={(event) => { setArticleStatus(event.currentTarget.value); setArticlePage(1) }}><option value="">Tous les statuts</option>{Object.entries(statusNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
          <Select aria-label="Filtrer par fournisseur" value={articleSupplier} onChange={(event) => { setArticleSupplier(event.currentTarget.value); setArticlePage(1) }}><option value="">Tous les fournisseurs</option>{[...new Set(trackedArticles.map((item) => item.fournisseurPrincipalId).filter((value): value is string => Boolean(value)))].map((id) => <option key={id} value={id}>{suppliers.find((supplier) => supplier.id === id)?.raisonSociale ?? id}</option>)}</Select>
          <Select aria-label="Trier les articles" value={articleSort} onChange={(event) => { setArticleSort(event.currentTarget.value as typeof articleSort); setArticlePage(1) }}><option value="name">Trier par nom</option><option value="quantity">Trier par quantité</option><option value="value">Trier par valeur</option></Select>
        </>}
      </div>
      {visibleArticles.map((article) => {
      const amount = articleDepot ? (allLevels.find((level) => level.articleId === article.id && level.depotId === articleDepot)?.quantite ?? 0) : (quantities.get(article.id) ?? 0)
      return <div key={article.id} className="border-b py-3 text-sm">
        <Link to={`/stock/articles/${article.id}`} className="flex flex-wrap items-center justify-between gap-3">
          <span><strong>{article.code} · {article.designation}</strong><small className="block text-slate-500">{article.categorie || article.unite}</small></span>
          <span className="flex items-center gap-2"><strong>{amount} {article.unite}</strong>{!isTechnician && <span className="text-slate-500">PMP {formatMoney((costMap.get(article.id)?.pmpHT ?? 0) / 100)}</span>}<Badge variant={statusColors[statutStock(article, amount)]}>{statusNames[statutStock(article, amount)]}</Badge></span>
        </Link>
        {!isTechnician && !articleDepot && <details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">Quantité par dépôt</summary><div className="mt-2 grid gap-1 pl-3 sm:grid-cols-2">{scopedLevels(article.id).map((level) => <span key={level.id}>{depotMap.get(level.depotId)?.nom ?? 'Dépôt'} : {level.quantite} {level.unite}</span>)}{!scopedLevels(article.id).length && <span>Aucun niveau de stock enregistré.</span>}</div></details>}
      </div>
      })}{!matchingArticles.length && <p className="py-5 text-center text-sm text-slate-500">Aucun article suivi pour ces filtres.</p>}
      {!isTechnician && articlePageCount > 1 && <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span>{matchingArticles.length} article(s) · page {articlePage}/{articlePageCount}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={articlePage <= 1} onClick={() => setArticlePage((page) => page - 1)}>Précédent</Button><Button size="sm" variant="outline" disabled={articlePage >= articlePageCount} onClick={() => setArticlePage((page) => page + 1)}>Suivant</Button></div></div>}
    </Card>}
    {!isTechnician && section === 'depots' && <Card className="divide-y p-4">{depots.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><Link to={`/stock/depots/${item.id}`} className="min-w-0 flex-1"><strong>{item.code} · {item.nom}</strong><small className="block text-slate-500">{item.type}{item.technicienId ? ` · Technicien ${item.technicienId}` : ''}</small></Link><Badge variant={item.actif ? 'success' : 'default'}>{item.actif ? 'Actif' : 'Inactif'}</Badge>{isDirector && <><Button size="sm" variant="outline" onClick={() => { setEditingDepot(item); setEditDepotName(item.nom); setEditDepotAddress(item.adresse); setEditDepotType(item.type); setEditDepotTechnicianId(item.technicienId ?? '') }}>Modifier</Button><Button size="sm" variant="outline" loading={updateDepot.isPending} onClick={() => void updateDepot.mutateAsync({ depot: item, changes: { actif: !item.actif } }).then(() => toast.success(item.actif ? 'Dépôt désactivé.' : 'Dépôt réactivé.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Mise à jour impossible.'))}>{item.actif ? 'Désactiver' : 'Réactiver'}</Button></>}</div>)}{!depots.length && <p className="py-5 text-sm text-slate-500">Aucun dépôt configuré.</p>}</Card>}
    {!isTechnician && section === 'mouvements' && <>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input value={search} onChange={(event) => { setSearch(event.currentTarget.value); setMovementPage(1) }} placeholder="Rechercher numéro, article, motif…" />
        <Select aria-label="Filtrer par type" value={movementType} onChange={(event) => { setMovementType(event.currentTarget.value); setMovementPage(1) }}><option value="">Tous les types</option>{Object.entries(movementNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
        <Select aria-label="Filtrer par dépôt" value={movementDepot} onChange={(event) => { setMovementDepot(event.currentTarget.value); setMovementPage(1) }}><option value="">Tous les dépôts</option>{depots.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select>
        <Select aria-label="Filtrer par article" value={movementArticle} onChange={(event) => { setMovementArticle(event.currentTarget.value); setMovementPage(1) }}><option value="">Tous les articles</option>{trackedArticles.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.designation}</option>)}</Select>
        <Select aria-label="Trier les mouvements" value={movementSort} onChange={(event) => setMovementSort(event.currentTarget.value as typeof movementSort)}><option value="date">Plus récents</option><option value="article">Article</option><option value="quantity">Quantité</option></Select>
        <Input aria-label="Filtrer par auteur" value={movementAuthor} onChange={(event) => { setMovementAuthor(event.currentTarget.value); setMovementPage(1) }} placeholder="Auteur" />
        <label className="text-xs text-slate-500">Du<Input type="date" value={movementFrom} onChange={(event) => { setMovementFrom(event.currentTarget.value); setMovementPage(1) }} /></label>
        <label className="text-xs text-slate-500">Au<Input type="date" value={movementTo} onChange={(event) => { setMovementTo(event.currentTarget.value); setMovementPage(1) }} /></label>
      </div>
      <Card className="divide-y p-4">{visibleMovements.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><strong>{item.numero} · {item.designationSnapshot}</strong><small className="block text-slate-500">{movementNames[item.type]} · {item.quantite} {item.unite} · {item.motif} · {item.auteurNom}</small></span><span className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => void openMovementDocument(item)}>Bon</Button><Badge>{item.annule ? 'Annulé' : 'Actif'}</Badge>{isDirector && !item.annule && <Button size="sm" variant="danger" onClick={() => { const reason = window.prompt('Motif de l’annulation'); if (reason?.trim() && window.confirm('Créer un mouvement inverse ?')) void cancel.mutateAsync({ movement: item, motif: reason }).then(() => toast.success('Mouvement inverse créé.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Annulation refusée.')) }}>Annuler</Button>}</span></div>)}
      {!visibleMovements.length && <p className="py-5 text-center text-sm text-slate-500">Aucun mouvement ne correspond aux filtres.</p>}
      {movementPageCount > 1 && <div className="flex items-center justify-between pt-3 text-sm"><span>{matchingMovements.length} mouvement(s) · page {movementPage}/{movementPageCount}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={movementPage <= 1} onClick={() => setMovementPage((page) => page - 1)}>Précédent</Button><Button size="sm" variant="outline" disabled={movementPage >= movementPageCount} onClick={() => setMovementPage((page) => page + 1)}>Suivant</Button></div></div>}
      </Card>
    </>}
    {!isTechnician && section === 'inventaires' && <div className="space-y-4"><div className="flex gap-2"><Select aria-label="Dépôt à inventorier" value={inventoryDepot} onChange={(event) => setInventoryDepot(event.currentTarget.value)}><option value="">Sélectionner un dépôt</option>{depots.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}</Select></div>{currentInventory ? <Card className="p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{currentInventory.numero} · Comptage</h2><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => navigate('/documents/editor', { state: { document: createInventoryFicha(settings, currentInventory, currentInventory.statut === 'en_cours') } })}>Fiche de comptage</Button>{currentInventory.statut === 'valide' && <Button size="sm" variant="outline" onClick={() => navigate('/documents/editor', { state: { document: createInventoryFicha(settings, currentInventory, false) } })}>Rapport des écarts</Button>}</div></div>{currentInventory.lignes.map((line) => <div key={line.articleId} className="grid grid-cols-[1fr_6rem_7rem] items-center gap-2 border-b py-2 text-sm"><span>{line.designationSnapshot}<small className="block text-slate-500">Théorique : {line.quantiteTheorique}</small></span><Input aria-label={`Quantité comptée ${line.designationSnapshot}`} disabled={currentInventory.statut !== 'en_cours'} type="number" min="0" step="0.001" value={countValues[line.articleId] ?? (line.quantiteComptee === undefined ? '' : String(line.quantiteComptee))} onChange={(event) => setCountValues((values) => ({ ...values, [line.articleId]: event.currentTarget.value }))} /><span>{countValues[line.articleId] === undefined ? line.ecart === undefined ? '—' : `Écart : ${line.ecart}` : `Écart : ${calculerEcartInventaire(line.quantiteTheorique, Number(countValues[line.articleId]), line.coutUnitaire).ecart}`}</span></div>)}{currentInventory.statut === 'en_cours' && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => void saveInventory()} loading={saveCounts.isPending}>Enregistrer le comptage</Button>{isDirector && <Button variant="primary" onClick={() => void validateCurrentInventory()} loading={validateInventory.isPending}>Valider et ajuster le stock</Button>}</div>}</Card> : <Card className="divide-y p-4">{inventories.map((item) => <button key={item.id} className="flex w-full justify-between py-3 text-left text-sm" onClick={() => { setActiveInventory(item.id); setInventoryDepot(item.depotId); setCountValues(Object.fromEntries(item.lignes.flatMap((line) => line.quantiteComptee === undefined ? [] : [[line.articleId, String(line.quantiteComptee)]]))) }}><span>{item.numero} · {depotMap.get(item.depotId)?.nom}</span><Badge>{item.statut}</Badge></button>)}{!inventories.length && <p className="py-4 text-sm text-slate-500">Aucun inventaire.</p>}</Card>}</div>}
    {movementModal && <StockMovementModal articles={articles} depots={depots.filter((item) => item.actif && !item.archive)} onClose={() => setMovementModal(false)} onSave={(input) => apply.mutateAsync(input)} />}
    {depotModal && <Modal open onClose={() => setDepotModal(false)} title="Créer un dépôt"><form className="space-y-4" onSubmit={(event) => void saveDepot(event)}><label className="block space-y-1 text-sm">Nom du dépôt<Input required value={newDepotName} onChange={(event) => setNewDepotName(event.currentTarget.value)} /></label><label className="block space-y-1 text-sm">Type<Select value={newDepotType} onChange={(event) => setNewDepotType(event.currentTarget.value as typeof newDepotType)}><option value="principal">Principal</option><option value="vehicule">Véhicule</option><option value="chantier">Chantier</option><option value="autre">Autre</option></Select></label>{newDepotType === 'vehicule' && <TechnicienPicker value={depotTechnicianId} onChange={setDepotTechnicianId} label="Technicien titulaire" />}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDepotModal(false)}>Annuler</Button><Button type="submit" loading={createDepot.isPending}>Créer</Button></div></form></Modal>}
    {editingDepot && <Modal open onClose={() => setEditingDepot(undefined)} title={`Modifier ${editingDepot.nom}`}><form className="space-y-4" onSubmit={(event) => void saveDepotChanges(event)}><label className="block space-y-1 text-sm">Nom<Input required value={editDepotName} onChange={(event) => setEditDepotName(event.currentTarget.value)} /></label><label className="block space-y-1 text-sm">Adresse<Input value={editDepotAddress} onChange={(event) => setEditDepotAddress(event.currentTarget.value)} /></label><label className="block space-y-1 text-sm">Type<Select value={editDepotType} onChange={(event) => setEditDepotType(event.currentTarget.value as Depot['type'])}><option value="principal">Principal</option><option value="vehicule">Véhicule</option><option value="chantier">Chantier</option><option value="autre">Autre</option></Select></label>{editDepotType === 'vehicule' && <TechnicienPicker value={editDepotTechnicianId} onChange={setEditDepotTechnicianId} label="Technicien titulaire" />}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingDepot(undefined)}>Annuler</Button><Button type="submit" loading={updateDepot.isPending}>Enregistrer</Button></div></form></Modal>}
  </>
}
