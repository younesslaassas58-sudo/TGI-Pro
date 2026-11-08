import { useMemo, useState } from 'react'
import { Input, Select } from '@/components/ui'
import { useAscenseurs } from './useAscenseurs'

export function AscenseurPicker({
  clientId,
  value,
  onChange,
}: {
  clientId: string
  value: string
  onChange: (id: string) => void
}) {
  const { data = [], isLoading } = useAscenseurs(clientId)
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => data.filter((item) => `${item.code} ${item.marque} ${item.numeroSerie}`.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  )
  return (
    <div className="space-y-2">
      <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Rechercher un appareil…" aria-label="Rechercher un appareil" />
      <Select value={value} onChange={(event) => onChange(event.currentTarget.value)} disabled={!clientId || isLoading} aria-label="Appareil">
        <option value="">{!clientId ? 'Choisissez d’abord un client' : 'Sélectionner un appareil'}</option>
        {filtered.filter((item) => !item.archive).map((item) => (
          <option key={item.id} value={item.id}>{item.code} · {item.marque} {item.modele}</option>
        ))}
      </Select>
    </div>
  )
}
