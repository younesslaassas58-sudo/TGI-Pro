import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, Spinner } from '@/components/ui'
import { useClients } from '@/features/clients/useClients'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { useAuth } from '@/features/auth/authStore'
import { useTechniciens, useTechnicienPrive } from '@/features/techniciens/useTechniciens'
import { useInterventions, useInterventionMedias } from '@/features/interventions/useInterventions'
import { createInterventionDocument } from '@/features/interventions/interventionDocument'
import { getNextNumber } from './getNextNumber'
import { createAscenseurFicha, createClientFicha, createTechnicienFicha } from './fichaModel'
import { DocumentEditor } from './DocumentEditor'
import { documentModelSchema } from './schema'
import type { DocumentModel } from './types'

interface FichaRequest {
  entity: 'client' | 'ascenseur' | 'technicien' | 'intervention'
  id: string
  kind?: 'bon_intervention' | 'rapport_intervention'
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
    || (ficha.entity !== 'client' && ficha.entity !== 'ascenseur' && ficha.entity !== 'technicien' && ficha.entity !== 'intervention')
  ) return undefined
  if ('kind' in ficha && ficha.kind !== 'bon_intervention' && ficha.kind !== 'rapport_intervention') return undefined
  return {
    entity: ficha.entity,
    id: ficha.id,
    ...('kind' in ficha && typeof ficha.kind === 'string' ? { kind: ficha.kind as FichaRequest['kind'] } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readDocumentModel(value: unknown): DocumentModel | undefined {
  if (!isRecord(value) || !('document' in value) || !isRecord(value.document)) return undefined
  const parsed = documentModelSchema.safeParse(value.document)
  return parsed.success ? parsed.data : undefined
}

export function DocumentEditorPage() {
  const location = useLocation()
  const request = useMemo(() => readRequest(location.state), [location.state])
  const initialDocument = useMemo(() => readDocumentModel(location.state), [location.state])
  const { settings, isLoading: settingsLoading, error: settingsError } = useCompanySettings()
  const { data: clients = [], isLoading: clientsLoading } = useClients()
  const { data: elevators = [], isLoading: elevatorsLoading } = useAscenseurs()
  const { data: technicians = [], isLoading: techniciansLoading } = useTechniciens()
  const interventionsQuery = useInterventions()
  const interventionMediaQuery = useInterventionMedias(request?.entity === 'intervention' ? request.id : undefined)
  const isDirector = useAuth((state) => state.profile?.role === 'directeur')
  const technicianId = request?.entity === 'technicien' ? request.id : undefined
  const privateQuery = useTechnicienPrive(technicianId, isDirector)
  const [prepared, setPrepared] = useState<{ key: string; model: DocumentModel }>()
  const [error, setError] = useState(false)
  const pending = useRef<{ key: string; task: Promise<DocumentModel> } | null>(null)
  const requestKey = request ? `${request.entity}:${request.id}:${request.kind ?? ''}` : ''
  const model = prepared?.key === requestKey ? prepared.model : undefined

  useEffect(() => {
    if (!request || settingsLoading || clientsLoading || elevatorsLoading || techniciansLoading || model) return
    if (request.entity === 'technicien' && isDirector && privateQuery.isLoading) return
    if (request.entity === 'technicien' && privateQuery.isError) return
    if (request.entity === 'intervention' && (interventionsQuery.isLoading || interventionMediaQuery.isLoading)) return
    let active = true
    const key = `${request.entity}:${request.id}:${request.kind ?? ''}`
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
        if (request.entity === 'ascenseur') {
          if (!item) throw new Error('Appareil introuvable.')
          const number = await getNextNumber('fiche_ascenseur')
          return createAscenseurFicha(item, clients.find((client) => client.id === item.clientId), settings, number)
        }
        if (request.entity === 'intervention') {
          const intervention = interventionsQuery.data?.find((entry) => entry.id === request.id)
          if (!intervention) throw new Error('Intervention introuvable ou non accessible.')
          const kind = request.kind ?? 'rapport_intervention'
          const number = await getNextNumber(kind)
          return createInterventionDocument(
            intervention,
            clients.find((client) => client.id === intervention.clientId),
            settings,
            number,
            kind,
            interventionMediaQuery.data ?? [],
            technicians
              .filter((technician) => intervention.techniciensIds.includes(technician.id))
              .map((technician) => `${technician.prenom} ${technician.nom}`),
          )
        }
        const technician = technicians.find((entry) => entry.id === request.id)
        if (!technician) throw new Error('Technicien introuvable ou non accessible.')
        const number = await getNextNumber('fiche_technicien')
        return createTechnicienFicha(technician, settings, number, isDirector ? privateQuery.data : undefined)
      })()
      pending.current = { key, task }
    }
    void task.then((result) => {
      if (active) setPrepared({ key, model: result })
    }).catch(() => {
      if (active) setError(true)
    })
    return () => { active = false }
  }, [request, settingsLoading, clientsLoading, elevatorsLoading, techniciansLoading, model, clients, elevators, settings, technicians, isDirector, privateQuery.isLoading, privateQuery.isError, privateQuery.data, interventionsQuery.isLoading, interventionsQuery.data, interventionMediaQuery.isLoading, interventionMediaQuery.data])

  if (initialDocument) return <DocumentEditor initialModel={initialDocument} />
  if (!request) return <Card className="p-6 text-sm text-danger-700">Aucun document n’a été sélectionné. Ouvrez cette page depuis le détail d’un client, d’un appareil, d’un technicien ou d’une intervention.</Card>
  if (settingsError || error || privateQuery.isError || interventionsQuery.isError || interventionMediaQuery.isError) return <Card className="p-6 text-sm text-danger-700">Impossible de préparer la fiche. Vérifiez les données et vos droits.</Card>
  if (!model) return <Card className="p-8"><Spinner label="Préparation de la fiche documentaire" /></Card>
  return <DocumentEditor key={requestKey} initialModel={model} />
}
