import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button, Input, Modal, Select, useToast } from '@/components/ui'
import { usePermission } from '@/features/auth/usePermission'
import { ClientForm } from './ClientForm'
import { useClients, useSaveClient } from './useClients'
import type { ClientInput } from './types'

export function ClientPicker({
  value,
  onChange,
  onQuickCreate,
  disabled = false,
}: {
  value: string
  onChange: (clientId: string) => void
  onQuickCreate?: () => void
  disabled?: boolean
}) {
  const { data = [], isLoading } = useClients()
  const save = useSaveClient()
  const toast = useToast()
  const canCreate = usePermission('clients', 'creer')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const clients = useMemo(
    () =>
      data
        .filter((client) => !client.archive)
        .filter((client) =>
          `${client.code} ${client.raisonSociale} ${client.ville}`
            .toLocaleLowerCase('fr')
            .includes(search.toLocaleLowerCase('fr')),
        ),
    [data, search],
  )

  async function createClient(input: ClientInput) {
    try {
      const id = await save.mutateAsync({ input })
      onChange(id)
      setCreating(false)
      toast.success('Client créé et sélectionné.')
    } catch {
      toast.error('Impossible de créer le client.')
    }
  }

  return (
    <>
    <div className="space-y-2">
      <label className="relative block">
        <span className="sr-only">Rechercher un client</span>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input value={search} onChange={(event) => setSearch(event.currentTarget.value)} className="pl-9" placeholder="Rechercher par code, nom ou ville…" />
      </label>
      <Select aria-label="Client" value={value} disabled={disabled || isLoading} onChange={(event) => onChange(event.currentTarget.value)}>
        <option value="">{isLoading ? 'Chargement des clients…' : 'Sélectionner un client'}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.code} · {client.raisonSociale} · {client.ville}
          </option>
        ))}
      </Select>
      {canCreate && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onQuickCreate ? onQuickCreate() : setCreating(true)}>
          <Plus size={14} aria-hidden="true" /> Créer un client
        </Button>
      )}
    </div>
    <Modal open={creating} onClose={() => setCreating(false)} title="Création rapide d’un client" className="w-[min(100%-2rem,56rem)]">
      {creating && <ClientForm busy={save.isPending} onCancel={() => setCreating(false)} onSave={(input) => void createClient(input)} />}
    </Modal>
    </>
  )
}
