import { useMemo, useState } from 'react'
import { Input, Select } from '@/components/ui'
import { useCatalogue } from '@/features/catalogue/useCatalogue'
import { useAuth } from '@/features/auth/authStore'
import { useStockNiveaux } from './useStock'

export function StockArticlePicker({
  value,
  depotId,
  onChange,
  disabled = false,
}: {
  value: string
  depotId: string
  onChange: (articleId: string, article?: { designation: string; unite: string }) => void
  disabled?: boolean
}) {
  const isTechnician = useAuth((state) => state.profile?.role === 'technicien')
  const { data: articles = [], isLoading: articlesLoading } = useCatalogue(!isTechnician)
  const { data: levels = [] } = useStockNiveaux(depotId, Boolean(depotId))
  const [search, setSearch] = useState('')
  const amounts = new Map(levels.map((level) => [level.articleId, level.quantite]))
  const options = useMemo(() => (isTechnician
    ? levels.map((level) => ({ id: level.articleId, code: level.codeSnapshot, designation: level.designationSnapshot, reference: '', unite: level.unite }))
    : articles.filter((article) => article.suiviStock && !article.archive)
      .map((article) => ({ id: article.id, code: article.code, designation: article.designation, reference: article.reference, unite: article.unite })))
    .filter((article) => `${article.code} ${article.designation} ${article.reference}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))), [articles, isTechnician, levels, search])
  return <div className="space-y-2">
    <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Rechercher un article de stock…" aria-label="Rechercher un article de stock" disabled={disabled} />
    <Select value={value} onChange={(event) => {
      const article = options.find((item) => item.id === event.currentTarget.value)
      onChange(event.currentTarget.value, article ? { designation: article.designation, unite: article.unite } : undefined)
    }} disabled={disabled || (articlesLoading && !isTechnician)} aria-label="Article suivi en stock">
      <option value="">{articlesLoading && !isTechnician ? 'Chargement…' : 'Sélectionner un article'}</option>
      {options.map((article) => <option key={article.id} value={article.id}>{article.code} · {article.designation} · Disponible : {amounts.get(article.id) ?? 0}</option>)}
    </Select>
  </div>
}
