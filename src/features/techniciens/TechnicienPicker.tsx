import { useMemo, useState } from 'react'
import { Avatar, Badge, Input } from '@/components/ui'
import { useTechniciens } from './useTechniciens'

export interface TechnicienPickerProps {
  value: string
  onChange: (technicianId: string) => void
  activeOnly?: boolean
  disabled?: boolean
  label?: string
}

export function TechnicienPicker({
  value,
  onChange,
  activeOnly = true,
  disabled = false,
  label = 'Technicien',
}: TechnicienPickerProps) {
  const { data = [], isLoading, error } = useTechniciens()
  const [search, setSearch] = useState('')
  const technicians = useMemo(() => data.filter((item) =>
    (!activeOnly || (item.statut === 'actif' && !item.archive))
    && `${item.prenom} ${item.nom} ${item.matricule}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  ), [activeOnly, data, search])
  const selected = data.find((item) => item.id === value)

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={`technicien-picker-${label}`}>{label}</label>
      <Input
        id={`technicien-picker-${label}`}
        value={search}
        onChange={(event) => setSearch(event.currentTarget.value)}
        placeholder="Rechercher un technicien…"
        disabled={disabled}
        aria-label="Rechercher un technicien"
      />
      {selected && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-sm">
          <Avatar name={`${selected.prenom} ${selected.nom}`} src={selected.photoURL || undefined} size="sm" />
          <span className="min-w-0 flex-1 truncate">{selected.prenom} {selected.nom} <span className="text-xs text-slate-500">· {selected.matricule}</span></span>
          <Badge className={selected.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : selected.statut === 'conge' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}>
            {selected.statut === 'actif' ? 'Actif' : selected.statut === 'conge' ? 'En congé' : 'Inactif'}
          </Badge>
        </div>
      )}
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1" role="listbox" aria-label="Résultats des techniciens">
        <button type="button" disabled={disabled} onClick={() => onChange('')} className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
          Aucun technicien sélectionné
        </button>
        {isLoading ? <p className="px-3 py-2 text-sm text-slate-500">Chargement…</p>
          : technicians.map((item) => <button
            type="button"
            role="option"
            aria-selected={value === item.id}
            key={item.id}
            disabled={disabled}
            onClick={() => onChange(item.id)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
          >
            <Avatar name={`${item.prenom} ${item.nom}`} src={item.photoURL || undefined} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{item.prenom} {item.nom}<span className="ml-1 font-mono text-xs text-slate-500">{item.matricule}</span></span>
            <Badge className={item.statut === 'actif' ? 'bg-emerald-50 text-emerald-700' : item.statut === 'conge' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}>
              {item.statut === 'actif' ? 'Actif' : item.statut === 'conge' ? 'En congé' : 'Inactif'}
            </Badge>
          </button>)}
      </div>
      {error && <p className="text-xs text-danger-700">Impossible de charger les techniciens.</p>}
    </div>
  )
}
