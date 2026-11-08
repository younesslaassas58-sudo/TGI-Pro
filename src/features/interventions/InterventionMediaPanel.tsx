import { useState } from 'react'
import { Card, useToast } from '@/components/ui'
import { usePermission } from '@/features/auth/usePermission'
import { SignaturePad } from './SignaturePad'
import { useInterventionMedias, useSaveInterventionMedia } from './useInterventions'
import type { InterventionMedia } from './types'

function dataUrlFile(dataUrl: string): File {
  const [header, encoded] = dataUrl.split(',')
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/jpeg'
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  return new File([bytes], 'signature.jpg', { type: mime })
}

export function InterventionMediaPanel({
  interventionId,
  signatureMediaId,
  assignedToUid,
  status,
}: {
  interventionId: string
  signatureMediaId?: string
  assignedToUid?: string
  status: string
}) {
  const toast = useToast()
  const { data = [], isLoading } = useInterventionMedias(interventionId)
  const save = useSaveInterventionMedia()
  const canEdit = usePermission('interventions', 'modifier', { assignedToUid })
    && !['terminee', 'cloturee', 'annulee'].includes(status)
  const [savingType, setSavingType] = useState<InterventionMedia['type']>()
  const signature = data.find((item) => item.id === signatureMediaId || item.type === 'signature')

  async function saveFile(file: File, type: InterventionMedia['type']) {
    setSavingType(type)
    try {
      await save.mutateAsync({ interventionId, file, type })
      toast.success(type === 'signature' ? 'Signature enregistrée.' : 'Photo ajoutée.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le média.')
    } finally {
      setSavingType(undefined)
    }
  }

  return <section className="space-y-3">
    <h2 className="font-heading text-lg font-semibold text-navy-900">Photos et signature</h2>
    {isLoading ? <p className="text-sm text-slate-500">Chargement des médias…</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.filter((item) => item.type !== 'signature').map((item) => <Card key={item.id} className="p-2">
        <img src={item.dataUrl} alt={item.type === 'photo_avant' ? 'Photo avant intervention' : 'Photo après intervention'} className="aspect-video w-full rounded-lg object-cover" />
        <p className="mt-2 text-xs text-slate-500">{item.type === 'photo_avant' ? 'Avant intervention' : 'Après intervention'}</p>
      </Card>)}
      {signature && <Card className="p-2"><img src={signature.dataUrl} alt="Signature du client" className="h-28 w-full rounded-lg bg-white object-contain" /><p className="mt-2 text-xs text-slate-500">Signature de {signatureMediaId ? 'l’intervention' : 'la personne présente'}</p></Card>}
      {!data.length && <p className="text-sm text-slate-500">Aucune photo ni signature enregistrée.</p>}
    </div>}
    {canEdit && <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Ajouter une photo</p>
        <label className="block text-sm text-slate-600">Photo avant <input className="mt-2 block w-full text-sm" type="file" accept="image/*" disabled={save.isPending} onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void saveFile(file, 'photo_avant')
          event.currentTarget.value = ''
        }} /></label>
        <label className="block text-sm text-slate-600">Photo après <input className="mt-2 block w-full text-sm" type="file" accept="image/*" disabled={save.isPending} onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void saveFile(file, 'photo_apres')
          event.currentTarget.value = ''
        }} /></label>
        {savingType && savingType !== 'signature' && <p className="text-xs text-slate-500">Compression et enregistrement…</p>}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Signature du client</p>
        <SignaturePad onChange={(value) => {
          if (value) void saveFile(dataUrlFile(value), 'signature')
        }} />
        {savingType === 'signature' && <p className="text-xs text-slate-500">Enregistrement…</p>}
      </div>
    </div>}
  </section>
}
