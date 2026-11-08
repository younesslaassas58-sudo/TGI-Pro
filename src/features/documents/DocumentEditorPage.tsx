import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, Spinner } from '@/components/ui'
import { useClients } from '@/features/clients/useClients'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { getNextNumber } from './getNextNumber'
import { createAscenseurFicha, createClientFicha } from './fichaModel'
import { DocumentEditor } from './DocumentEditor'
import type { DocumentModel } from './types'

interface FichaRequest {
  entity: 'client' | 'ascenseur'
  id: string
}

function readRequest(value: unknown): FichaRequest | undefined {
  if (typeof value !== 'object' || value === null || !('ficha' in value)) return undefined
  const ficha = value.ficha
  if (
    typeof ficha !== 'object'
    || ficha === null
    || !('entity' in ficha)
    || !('id' in ficha)
    || typeof ficha.id !== 'string'
    || (ficha.entity !== 'client' && ficha.entity !== 'ascenseur')
  ) return undefined
  return ficha as FichaRequest
}

export function DocumentEditorPage() {
  const location = useLocation()
  const request = useMemo(() => readRequest(location.state), [location.state])
  const { settings, isLoading: settingsLoading, error: settingsError } = useCompanySettings()
  const { data: clients = [], isLoading: clientsLoading } = useClients()
  const { data: elevators = [], isLoading: elevatorsLoading } = useAscenseurs()
  const [prepared, setPrepared] = useState<{ key: string; model: DocumentModel }>()
  const [error, setError] = useState(false)
  const pending = useRef<{ key: string; task: Promise<DocumentModel> } | null>(null)
  const requestKey = request ? `${request.entity}:${request.id}` : ''
  const model = prepared?.key === requestKey ? prepared.model : undefined

  useEffect(() => {
    if (!request || settingsLoading || clientsLoading || elevatorsLoading || model) return
    let active = true
    const key = `${request.entity}:${request.id}`
    let task = pending.current?.key === key ? pending.current.task : undefined
    if (!task) {
      task = (async () => {
        if (request.entity === 'client') {
          const client = clients.find((item) => item.id === request.id)
          if (!client) throw new Error('Client introuvable.')
          const number = await getNextNumber('fiche_client')
          return createClientFicha(client, elevators.filter((item) => item.clientId === client.id), settings, number)
        }
        const item = elevators.find((entry) => entry.id === request.id)
        if (!item) throw new Error('Appareil introuvable.')
        const number = await getNextNumber('fiche_ascenseur')
        return createAscenseurFicha(item, clients.find((client) => client.id === item.clientId), settings, number)
      })()
      pending.current = { key, task }
    }
    void task.then((result) => {
      if (active) setPrepared({ key, model: result })
    }).catch(() => {
      if (active) setError(true)
    })
    return () => { active = false }
  }, [request, settingsLoading, clientsLoading, elevatorsLoading, model, clients, elevators, settings])

  if (!request) return <Card className="p-6 text-sm text-danger-700">Aucune fiche n’a été sélectionnée. Ouvrez cette page depuis le détail d’un client ou d’un appareil.</Card>
  if (settingsError || error) return <Card className="p-6 text-sm text-danger-700">Impossible de préparer la fiche. Vérifiez les données et vos droits.</Card>
  if (!model) return <Card className="p-8"><Spinner label="Préparation de la fiche documentaire" /></Card>
  return <DocumentEditor initialModel={model} />
}
