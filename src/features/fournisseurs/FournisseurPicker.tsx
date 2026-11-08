import { useMemo, useState } from 'react'
import { Input, Select } from '@/components/ui'
import { useFournisseurs } from './useFournisseurs'

export function FournisseurPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (fournisseurId: string) => void
  disabled?: boolean
}) {
  const { data = [], isLoading } = useFournisseurs()
  const [search, setSearch] = useState('')
  const fournisseurs = useMemo(
    () => data.filter((fournisseur) =>
      (!fournisseur.archive || fournisseur.id === value)
      && `${fournisseur.code} ${fournisseur.raisonSociale} ${fournisseur.ville} ${fournisseur.ice}`
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
        placeholder="Rechercher un fournisseur…"
        aria-label="Rechercher un fournisseur"
      />
      <Select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={disabled || isLoading}
        aria-label="Fournisseur"
      >
        <option value="">{isLoading ? 'Chargement des fournisseurs…' : 'Sélectionner un fournisseur'}</option>
        {fournisseurs.map((fournisseur) => (
          <option key={fournisseur.id} value={fournisseur.id}>
            {fournisseur.code} · {fournisseur.raisonSociale} · {fournisseur.ville}
          </option>
        ))}
      </Select>
    </div>
  )
}
