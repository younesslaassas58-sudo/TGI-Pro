import { calculateTotals, formatDate, formatMoney } from '@/lib/format'
import type { CompanySettings } from '@/features/parametres/types'
import type { DocumentModel } from '@/features/documents/types'
import type { Article } from '@/features/catalogue/types'
import type { Depot, Inventaire, Mouvement, StockNiveau } from './types'
import { statutStock } from './logic'

function baseDocument(
  issuer: CompanySettings,
  title: string,
  number: string,
): DocumentModel {
  return {
    type: 'fiche',
    number,
    date: new Date().toISOString().slice(0, 10),
    title,
    issuer,
    recipient: {
      name: issuer.tradeName,
      address: issuer.address,
      city: issuer.city,
      ice: issuer.ice,
      phone: issuer.phones.filter(Boolean).join(' · '),
      email: issuer.email,
    },
    references: '',
    lines: [],
    totals: calculateTotals([]),
    notes: '',
    conditions: '',
    paymentMethod: '',
    deliveryTime: '',
    sections: [],
    options: {
      showLogo: true,
      showStamp: issuer.documentAppearance.showStamp,
      showSignature: issuer.documentAppearance.showSignature,
      showBankDetails: issuer.documentAppearance.showBankDetails,
      showAmountInWords: false,
      showWatermark: false,
      showLegalMentions: issuer.documentAppearance.showLegalMentions,
      showSlogan: issuer.documentAppearance.showSlogan,
      accentColor: issuer.documentAppearance.accentColor,
      orientation: 'landscape',
    },
  }
}

export function createStockStatement(
  issuer: CompanySettings,
  articles: Article[],
  levels: StockNiveau[],
  depots: Depot[],
  costs: Map<string, number>,
  number: string,
  selectedDepotId?: string,
  includeCosts = true,
): DocumentModel {
  const selectedLevels = selectedDepotId ? levels.filter((item) => item.depotId === selectedDepotId) : levels
  const depotMap = new Map(depots.map((item) => [item.id, item]))
  const totalsByArticle = new Map<string, number>()
  for (const level of selectedLevels) totalsByArticle.set(level.articleId, (totalsByArticle.get(level.articleId) ?? 0) + level.quantite)
  let totalValue = 0
  const rows = articles.filter((item) => item.suiviStock && !item.archive).map((article) => {
    const quantity = totalsByArticle.get(article.id) ?? 0
    const pmp = costs.get(article.id) ?? 0
    const value = Math.round(quantity * pmp)
    totalValue += value
    const row = [
      article.code,
      article.designation,
      article.unite,
      String(quantity),
      article.seuilAlerte === undefined ? '—' : String(article.seuilAlerte),
      statutStock(article, quantity),
      ...(includeCosts ? [formatMoney(pmp / 100), formatMoney(value / 100)] : []),
    ]
    return row
  })
  const depotLabel = selectedDepotId ? depotMap.get(selectedDepotId)?.nom ?? 'Dépôt' : 'Tous les dépôts'
  const model = baseDocument(issuer, 'Fiche de stock', number)
  model.references = `Périmètre : ${depotLabel}`
  model.notes = includeCosts ? `Valorisation totale : ${formatMoney(totalValue / 100)}.` : ''
  model.sections = [{
    id: 'stock-levels',
    title: `État du stock · ${depotLabel}`,
    kind: 'table',
    content: '',
    table: {
      columns: ['Code', 'Désignation', 'Unité', 'Quantité', 'Seuil', 'Statut', ...(includeCosts ? ['PMP HT', 'Valeur HT'] : [])],
      rows,
    },
  }]
  return model
}

export function createStockArticleFicha(
  issuer: CompanySettings,
  article: { code: string; designation: string; categorie: string; unite: string },
  levels: StockNiveau[],
  depots: Depot[],
  movements: Mouvement[],
  pmpHT: number,
  includeCosts = true,
): DocumentModel {
  const model = baseDocument(issuer, `Fiche article · ${article.designation}`, article.code)
  model.sections = [
    {
      id: 'article-summary',
      title: 'Article',
      kind: 'fields',
      content: '',
      fields: [
        { id: 'code', label: 'Code', value: article.code },
        { id: 'designation', label: 'Désignation', value: article.designation },
        { id: 'category', label: 'Catégorie', value: article.categorie },
        { id: 'unit', label: 'Unité', value: article.unite },
        ...(includeCosts ? [{ id: 'pmp', label: 'PMP HT', value: formatMoney(pmpHT / 100) }] : []),
      ],
    },
    {
      id: 'article-levels',
      title: 'Niveaux par dépôt',
      kind: 'table',
      content: '',
      table: {
        columns: ['Dépôt', 'Quantité', 'Mise à jour'],
        rows: levels.map((item) => [
          depots.find((depot) => depot.id === item.depotId)?.nom ?? item.depotId,
          `${item.quantite} ${item.unite}`,
          formatDate(item.updatedAt.slice(0, 10)),
        ]),
      },
    },
    {
      id: 'article-movements',
      title: 'Historique des mouvements',
      kind: 'table',
      content: '',
      table: {
        columns: ['Date', 'Numéro', 'Type', 'Quantité', 'Dépôt source', 'Dépôt destination', 'Solde après'],
        rows: movements.map((item) => [
          formatDate(item.date),
          item.numero,
          item.type,
          String(item.quantite),
          depots.find((depot) => depot.id === item.depotSourceId)?.nom ?? '—',
          depots.find((depot) => depot.id === item.depotDestinationId)?.nom ?? '—',
          String(item.soldeDestinationApres ?? item.soldeSourceApres ?? ''),
        ]),
      },
    },
  ]
  return model
}

export function createStockMovementDocument(
  issuer: CompanySettings,
  movement: Mouvement,
  depotSource?: Depot,
  depotDestination?: Depot,
  documentNumber = movement.numero,
): DocumentModel {
  const title = movement.type.startsWith('entree')
    ? 'Bon d’entrée de stock'
    : movement.type === 'transfert'
      ? 'Bon de transfert de stock'
      : 'Bon de sortie de stock'
  const model = baseDocument(issuer, title, documentNumber)
  model.recipient.name = depotDestination?.nom ?? depotSource?.nom ?? issuer.tradeName
  model.references = movement.reference ? `${movement.reference.type} · ${movement.reference.id}` : ''
  model.notes = movement.motif
  model.sections = [{
    id: 'movement-details',
    title: 'Détails du mouvement',
    kind: 'fields',
    content: '',
    fields: [
      { id: 'date', label: 'Date', value: formatDate(movement.date) },
      { id: 'type', label: 'Type', value: movement.type },
      { id: 'source', label: 'Dépôt source', value: depotSource?.nom ?? '—' },
      { id: 'destination', label: 'Dépôt destination', value: depotDestination?.nom ?? '—' },
      { id: 'issued-by', label: 'Émis par', value: movement.auteurNom },
      { id: 'received-by', label: 'Reçu par', value: '' },
    ],
  }, {
    id: 'movement-lines',
    title: 'Articles',
    kind: 'table',
    content: '',
    table: {
      columns: ['Code', 'Désignation', 'Unité', 'Quantité'],
      rows: [[movement.codeSnapshot, movement.designationSnapshot, movement.unite, String(movement.quantite)]],
    },
  }]
  return model
}

export function createInventoryFicha(issuer: CompanySettings, inventory: Inventaire, hideExpected = false): DocumentModel {
  const model = baseDocument(issuer, `Fiche d’inventaire · ${inventory.numero}`, inventory.numero)
  model.sections = [{
    id: 'inventory-lines',
    title: `Comptage du ${formatDate(inventory.date)}`,
    kind: 'table',
    content: '',
    table: {
      columns: ['Code', 'Désignation', ...(hideExpected ? [] : ['Quantité théorique']), 'Quantité comptée', 'Écart', 'Valeur écart'],
      rows: inventory.lignes.map((line) => [
        line.codeSnapshot,
        line.designationSnapshot,
        ...(!hideExpected ? [String(line.quantiteTheorique)] : []),
        line.quantiteComptee === undefined ? '' : String(line.quantiteComptee),
        line.ecart === undefined ? '' : String(line.ecart),
        line.valeurEcart === undefined ? '' : formatMoney(line.valeurEcart / 100),
      ]),
    },
  }]
  model.notes = inventory.notes
  return model
}

export function createReplenishmentFicha(
  issuer: CompanySettings,
  supplierName: string,
  rows: Array<{ article: Article; quantity: number; pmp: number }>,
): DocumentModel {
  const model = baseDocument(issuer, 'Liste de réapprovisionnement', `RAP-${new Date().toISOString().slice(0, 10)}`)
  model.recipient.name = supplierName || 'Fournisseur à définir'
  model.sections = [{
    id: 'replenishment',
    title: 'Articles à commander',
    kind: 'table',
    content: '',
    table: {
      columns: ['Code', 'Désignation', 'Unité', 'Quantité suggérée', 'Prix achat HT'],
      rows: rows.map(({ article, quantity, pmp }) => [
        article.code, article.designation, article.unite, String(quantity), formatMoney(pmp / 100),
      ]),
    },
  }]
  return model
}
