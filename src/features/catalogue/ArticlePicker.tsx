import { useMemo, useState } from 'react'
import { Input, Select } from '@/components/ui'
import { useAuth } from '@/features/auth/authStore'
import { useStockNiveaux } from '@/features/stock/useStock'
import { useCatalogue } from './useCatalogue'

export function ArticlePicker({
  value,
  onChange,
  disabled = false,
  depotId,
}: {
  value: string
  onChange: (articleId: string) => void
  disabled?: boolean
  depotId?: string
}) {
  const { data = [], isLoading } = useCatalogue()
  const role = useAuth((state) => state.profile?.role)
  const { data: levels = [] } = useStockNiveaux(depotId, role !== 'technicien')
  const [search, setSearch] = useState('')
  const articles = useMemo(
    () => data.filter((article) =>
      (!article.archive || article.id === value)
      && `${article.code} ${article.reference} ${article.designation} ${article.categorie}`
        .toLocaleLowerCase('fr')
        .includes(search.toLocaleLowerCase('fr')),
    ),
    [data, search, value],
  )

  return (
    <div className="space-y-2">
      <Input
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Rechercher un article…"
        aria-label="Rechercher un article"
      />
      <Select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled || isLoading}
        aria-label="Article"
      >
        <option value="">{isLoading ? 'Chargement des articles…' : 'Sélectionner un article'}</option>
        {articles.map((article) => (
          <option key={article.id} value={article.id}>
            {article.code} · {article.designation}{article.reference ? ` (${article.reference})` : ''}
            {article.suiviStock && role !== 'technicien' ? ` · Disponible : ${levels.filter((level) => level.articleId === article.id).reduce((sum, level) => sum + level.quantite, 0)}` : ''}
          </option>
        ))}
      </Select>
    </div>
  )
}
