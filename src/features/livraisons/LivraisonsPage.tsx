import { useRef, useState, type PointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Camera, Eraser, FilePlus2, FileText, PenLine } from 'lucide-react'
import { Button, Card, Input, Modal, Select, Textarea } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useToast } from '@/hooks/useToast'
import { toCommercialDocument } from '@/features/commercial/toDocumentModel'
import { useCommandes } from '@/features/commandes/useCommandes'
import type { Order } from '@/features/commandes/types'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { useDepots } from '@/features/stock/useStock'
import { useCancelLivraison, useCreateLivraison, useLivraisons, useUploadLivraisonMedia } from './useLivraisons'
import type { DeliveryInput } from './types'

function SignaturePad({ onChange }: { onChange: (value: string | undefined) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const bounds = canvas.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height
    if (!drawing.current) {
      context.beginPath()
      context.moveTo(x, y)
      drawing.current = true
    } else {
      context.lineTo(x, y)
      context.strokeStyle = '#0b1f3a'
      context.lineWidth = 3
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.stroke()
    }
    setHasInk(true)
  }

  function finish() {
    drawing.current = false
    const canvas = canvasRef.current
    if (canvas && hasInk) onChange(canvas.toDataURL('image/jpeg', 0.85))
  }

  function clear() {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(undefined)
  }

  return <div className="space-y-2">
    <div className="flex items-center justify-between"><span className="text-sm font-medium">Signature du réceptionnaire</span><Button type="button" size="sm" variant="ghost" onClick={clear}><Eraser size={14} /> Effacer</Button></div>
    <canvas
      ref={canvasRef}
      width={640}
      height={180}
      aria-label="Zone de signature"
      className="h-28 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        drawing.current = false
        point(event)
      }}
      onPointerMove={(event) => { if (event.buttons > 0) point(event) }}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  </div>
}

function DeliveryForm({ orders, onClose }: { orders: Order[]; onClose: () => void }) {
  const create = useCreateLivraison()
  const toast = useToast()
  const { data: depots = [] } = useDepots()
  const [orderId, setOrderId] = useState('')
  const [depotId, setDepotId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [signedBy, setSignedBy] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const order = orders.find((item) => item.id === orderId)
  const pendingLines = order?.lines.filter((line) => line.orderedQuantity > line.fulfilledQuantity) ?? []

  async function submit() {
    if (!order) {
      setError('Sélectionnez une commande client.')
      return
    }
    const lines: DeliveryInput['lines'] = pendingLines.flatMap((line) => {
      const quantity = quantities[line.id] ?? 0
      return quantity > 0 ? [{
        id: crypto.randomUUID(),
        orderLineId: line.id,
        designation: line.designation,
        unit: line.unit,
        quantity,
      }] : []
    })
    if (!lines.length) {
      setError('Saisissez au moins une quantité à livrer.')
      return
    }
    try {
      await create.mutateAsync({ orderId, depotId, lines, signedBy, signatureDataUrl, notes })
      toast.success('Bon de livraison enregistré et quantités mises à jour.')
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer le bon de livraison.')
    }
  }

  return <div className="max-h-[78vh] space-y-4 overflow-y-auto">
    <label className="block space-y-1 text-sm">Dépôt de sortie
      <Select value={depotId} onChange={(event) => setDepotId(event.currentTarget.value)}>
        <option value="">Sélectionner un dépôt</option>
        {depots.filter((depot) => depot.actif && !depot.archive).map((depot) => <option value={depot.id} key={depot.id}>{depot.code} · {depot.nom}</option>)}
      </Select>
    </label>
    <label className="block space-y-1 text-sm">Commande client
      <Select value={orderId} onChange={(event) => { setOrderId(event.currentTarget.value); setQuantities({}) }}>
        <option value="">Sélectionner une commande</option>
        {orders.filter((item) => item.kind === 'client' && ['ordered', 'partially_received'].includes(item.status)).map((item) => <option value={item.id} key={item.id}>{item.number} · {item.party.name}</option>)}
      </Select>
    </label>
    {order && <section className="space-y-3">
      <h3 className="font-semibold">Quantités à livrer — {order.party.name}</h3>
      {pendingLines.map((line) => {
        const remaining = Math.max(0, line.orderedQuantity - line.fulfilledQuantity)
        return <label key={line.id} className="grid grid-cols-[1fr_8rem] items-center gap-3 rounded-xl border border-slate-100 p-3 text-sm">
          <span>{line.designation}<small className="block text-slate-500">Commandé : {line.orderedQuantity} {line.unit} · Déjà livré : {line.fulfilledQuantity} · Reste : {remaining}</small></span>
          <Input aria-label={`Quantité à livrer : ${line.designation}`} type="number" min="0" max={remaining} step="0.001" value={quantities[line.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: Number(event.currentTarget.value) || 0 }))} />
        </label>
      })}
      {!pendingLines.length && <p className="text-sm text-slate-500">Toutes les lignes ont déjà été livrées.</p>}
    </section>}
    <label className="block space-y-1 text-sm">Nom du réceptionnaire<Input value={signedBy} onChange={(event) => setSignedBy(event.currentTarget.value)} /></label>
    <SignaturePad onChange={setSignatureDataUrl} />
    <label className="block space-y-1 text-sm">Observations<Textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} /></label>
    {error && <p className="text-sm text-danger-700" role="alert">{error}</p>}
    <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Fermer</Button><Button loading={create.isPending} onClick={() => void submit()}><FilePlus2 size={15} /> Enregistrer le bon</Button></div>
  </div>
}

export function LivraisonsPage() {
  const navigate = useNavigate()
  const { settings } = useCompanySettings()
  const { data: deliveries = [], isLoading, error } = useLivraisons()
  const { data: orders = [] } = useCommandes()
  const cancel = useCancelLivraison()
  const upload = useUploadLivraisonMedia()
  const toast = useToast()
  const [creating, setCreating] = useState(false)

  async function cancelDelivery(delivery: (typeof deliveries)[number]) {
    try {
      await cancel.mutateAsync(delivery)
      toast.success('Livraison annulée ; les quantités ont été restaurées.')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Annulation impossible.')
    }
  }

  async function uploadMedia(delivery: (typeof deliveries)[number], file: File | undefined) {
    if (!file) return
    try {
      await upload.mutateAsync({ delivery, file })
      toast.success('Média ajouté au bon de livraison.')
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Import du fichier impossible.')
    }
  }

  function generateDocument(delivery: (typeof deliveries)[number]) {
    const sections = [
      ...(delivery.signedBy || delivery.signatureDataUrl ? [{
        id: 'recipient-signature',
        title: 'Réceptionnaire',
        content: delivery.signedBy ? `Reçu par : ${delivery.signedBy}` : '',
        imageData: delivery.signatureDataUrl,
      }] : []),
      ...delivery.media.map((media) => ({
        id: media.id,
        title: media.name,
        content: '',
        imageData: media.dataUrl,
      })),
    ]
    navigate('/documents/editor', {
      state: {
        document: toCommercialDocument({
          type: 'livraison',
          number: delivery.number,
          date: delivery.deliveredAt?.slice(0, 10) ?? delivery.createdAt.slice(0, 10),
          title: `Bon de livraison ${delivery.number}`,
          issuer: settings,
          recipient: delivery.client,
          lines: delivery.lines,
          notes: delivery.notes,
          references: `Commande : ${delivery.orderNumber}`,
          sections,
        }),
      },
    })
  }

  return <>
    <PageHeader title="Bons de livraison" description="Enregistrez les livraisons partielles, les signatures et les pièces justificatives." action={<Button onClick={() => setCreating(true)}><FilePlus2 size={16} /> Nouvelle livraison</Button>} />
    <Card className="overflow-hidden">
      {isLoading ? <p className="p-6 text-sm text-slate-500">Chargement des livraisons…</p> : error ? <p className="p-6 text-sm text-danger-700">Impossible de charger les bons de livraison.</p> : !deliveries.length ? <p className="p-6 text-sm text-slate-500">Aucune livraison enregistrée.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Bon</th><th className="p-3">Commande</th><th className="p-3">Client</th><th className="p-3">Date</th><th className="p-3">Lignes livrées</th><th className="p-3">Signature / médias</th><th className="p-3">État / actions</th></tr></thead>
          <tbody>{[...deliveries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((delivery) => <tr className="border-t border-slate-100" key={delivery.id}>
            <td className="p-3 font-medium">{delivery.number}</td><td className="p-3">{delivery.orderNumber}</td><td className="p-3">{delivery.client.name}</td><td className="p-3">{delivery.deliveredAt?.slice(0, 10)}</td>
            <td className="p-3">{delivery.lines.map((line) => `${line.designation} × ${line.quantity}`).join(' · ')}</td>
            <td className="p-3">{delivery.signedBy || '—'}<small className="block text-slate-500">{delivery.media.length} fichier(s){delivery.signatureDataUrl ? ' · signature capturée' : ''}</small>
              {delivery.media.map((media) => <a className="mr-2 text-xs text-navy-700 underline" key={media.id} href={media.dataUrl} target="_blank" rel="noreferrer">{media.name}</a>)}</td>
            <td className="p-3"><div className="flex items-center gap-2"><Button size="sm" variant="ghost" aria-label="Générer le bon de livraison" onClick={() => generateDocument(delivery)}><FileText size={14} /></Button>{delivery.status === 'delivered' ? 'Livré' : 'Annulé'}
              {delivery.status === 'delivered' && <>
                <label className="cursor-pointer rounded-lg border border-slate-300 p-2" title="Ajouter une photo (compressée avant enregistrement)"><Camera size={14} /><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void uploadMedia(delivery, event.currentTarget.files?.[0]); event.currentTarget.value = '' }} /></label>
                <Button size="sm" variant="danger" aria-label="Annuler la livraison" onClick={() => void cancelDelivery(delivery)}><Ban size={14} /></Button>
              </>}
            </div></td>
          </tr>)}</tbody>
        </table></div>
      )}
    </Card>
    <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><PenLine size={14} /> Les bons de livraison n’affichent pas de prix. L’annulation restaure les quantités disponibles de la commande.</p>
    <Modal open={creating} onClose={() => setCreating(false)} title="Créer un bon de livraison" className="w-[min(100%-2rem,54rem)]">
      {creating && <DeliveryForm orders={orders} onClose={() => setCreating(false)} />}
    </Modal>
  </>
}
