import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowDown,
  ArrowLeft,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form'
import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Textarea,
  useToast,
} from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { getNextNumber } from './getNextNumber'
import { exportDocument, printDocument, renderDocument, type ExportFormat } from './exportDocument'
import { calculateTotals, formatMoney } from '@/lib/format'
import type { DocumentModel } from './types'
import { documentModelSchema } from './schema'

type EditorTab = 'edit' | 'preview'

function freshLine(vatPercent: number) {
  return {
    id: crypto.randomUUID(),
    designation: '',
    description: '',
    quantity: 1,
    unit: 'unité',
    unitPriceHT: 0,
    discountPercent: 0,
    vatPercent,
  }
}

function OptionToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 transition hover:border-gold-200">
      <input
        type="checkbox"
        className="size-3.5 accent-navy-900"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  )
}

export interface DocumentEditorProps {
  initialModel: DocumentModel
  onLoadStressTest?: () => void
}

export function DocumentEditor({ initialModel, onLoadStressTest }: DocumentEditorProps) {
  const toast = useToast()
  const [mobileTab, setMobileTab] = useState<EditorTab>('edit')
  const [previewUrl, setPreviewUrl] = useState<string>()
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string>()
  const [exporting, setExporting] = useState<ExportFormat | 'print' | null>(null)
  const {
    register,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<DocumentModel>({
    resolver: zodResolver(documentModelSchema),
    defaultValues: initialModel,
    mode: 'onChange',
  })
  const lines = useFieldArray({ control, name: 'lines' })
  const sections = useFieldArray({ control, name: 'sections' })
  useWatch({ control })
  const model = getValues()
  const totals = useMemo(() => calculateTotals(model.lines), [model.lines])
  const readyModel = useMemo(() => ({ ...model, totals }), [model, totals])
  const isPriceFreeDelivery = model.type === 'livraison'

  useEffect(() => {
    reset(initialModel)
  }, [initialModel, reset])

  useEffect(() => {
    let active = true
    let currentUrl: string | undefined

    const timer = window.setTimeout(() => {
      setPreviewLoading(true)
      setPreviewError(undefined)
      void (async () => {
        try {
          const blob = await renderDocument(readyModel, 'pdf')
          if (!active) return
          currentUrl = URL.createObjectURL(blob)
          setPreviewUrl(currentUrl)
          setPreviewLoading(false)
        } catch {
          if (!active) return
          setPreviewError('L’aperçu PDF n’a pas pu être généré.')
          setPreviewLoading(false)
        }
      })()
    }, 400)

    return () => {
      active = false
      window.clearTimeout(timer)
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [readyModel])

  async function handleExport(format: ExportFormat | 'print') {
    setExporting(format)
    try {
      const currentModel = { ...getValues(), totals: calculateTotals(getValues('lines')) }
      if (format === 'print') await printDocument(currentModel)
      else await exportDocument(currentModel, format)
      if (format !== 'print') toast.success('Le document a été exporté.')
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'L’export du document a échoué.')
    } finally {
      setExporting(null)
    }
  }

  async function allocateNumber() {
    try {
      const type = getValues('type')
      const numberType = type === 'fiche' ? getValues('numberingType') : type
      if (!numberType) throw new Error('Type de numérotation absent pour cette fiche.')
      const number = await getNextNumber(numberType)
      setValue('number', number, { shouldDirty: true })
      toast.success(`Nouveau numéro attribué : ${number}`)
    } catch {
      toast.error('Impossible d’attribuer un numéro. Vérifiez vos droits et votre connexion.')
    }
  }

  function moveLine(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= lines.fields.length) return
    lines.move(index, target)
  }

  function duplicateLine(index: number) {
    const source = getValues(`lines.${index}`)
    lines.insert(index + 1, { ...source, id: crypto.randomUUID() })
  }

  function updateOption(
    option:
      | 'showLogo'
      | 'showStamp'
      | 'showSignature'
      | 'showBankDetails'
      | 'showAmountInWords'
      | 'showWatermark'
      | 'showLegalMentions'
      | 'showSlogan',
    value: boolean,
  ) {
    setValue(`options.${option}`, value, { shouldDirty: true })
  }

  return (
    <>
      <PageHeader
        title="Éditeur de document"
        description="Modifiez le contenu, vérifiez l’aperçu puis exportez dans le format souhaité."
        action={onLoadStressTest ? (
          <Button type="button" variant="outline" size="sm" onClick={onLoadStressTest}>
            <RefreshCw size={15} aria-hidden="true" />
            Test de charge
          </Button>
        ) : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="gold">{model.type.toUpperCase()}</Badge>
          <span className="text-sm font-semibold text-slate-700">{model.number}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => void allocateNumber()}>
            Attribuer un numéro
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" loading={exporting === 'print'} onClick={() => void handleExport('print')}>
            <Printer size={15} aria-hidden="true" /> Imprimer
          </Button>
          <Button type="button" variant="outline" size="sm" loading={exporting === 'excel'} onClick={() => void handleExport('excel')}>
            <FileSpreadsheet size={15} aria-hidden="true" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" loading={exporting === 'word'} onClick={() => void handleExport('word')}>
            <FileText size={15} aria-hidden="true" /> Word
          </Button>
          <Button type="button" size="sm" loading={exporting === 'pdf'} onClick={() => void handleExport('pdf')}>
            <Download size={15} aria-hidden="true" /> PDF
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 md:hidden">
        <button
          type="button"
          className={`min-h-10 rounded-lg text-sm font-semibold ${mobileTab === 'edit' ? 'bg-navy-900 text-white' : 'text-slate-600'}`}
          onClick={() => setMobileTab('edit')}
        >
          Édition
        </button>
        <button
          type="button"
          className={`min-h-10 rounded-lg text-sm font-semibold ${mobileTab === 'preview' ? 'bg-navy-900 text-white' : 'text-slate-600'}`}
          onClick={() => setMobileTab('preview')}
        >
          Aperçu
        </button>
      </div>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className={`min-w-0 p-4 shadow-soft sm:p-5 ${mobileTab === 'preview' ? 'hidden md:block' : ''}`}>
          <form className="space-y-6">
            <fieldset className="space-y-3">
              <legend className="mb-3 font-heading text-sm font-semibold text-navy-900">En-tête</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="doc-title">Titre</Label>
                  <Input id="doc-title" {...register('title')} />
                  {errors.title && <p className="text-xs text-danger-700">{errors.title.message}</p>}
                </div>
                <div>
                  <Label htmlFor="doc-type">Type</Label>
                  <select id="doc-type" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" {...register('type')}>
                    <option value="devis">Devis</option>
                    <option value="commande">Bon de commande</option>
                    <option value="livraison">Bon de livraison</option>
                    <option value="facture">Facture</option>
                    <option value="recu">Reçu</option>
                    <option value="intervention">Fiche d’intervention</option>
                    <option value="client">Fiche client</option>
                    <option value="fiche">Fiche</option>
                  </select>
                </div>
                {model.type === 'fiche' && <div>
                  <Label htmlFor="fiche-number-type">Type de fiche</Label>
                  <select id="fiche-number-type" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" {...register('numberingType')}>
                    <option value="fiche_client">Fiche client</option>
                    <option value="fiche_ascenseur">Fiche appareil</option>
                    <option value="fiche_technicien">Fiche technicien</option>
                    <option value="bon_intervention">Bon d’intervention</option>
                    <option value="rapport_intervention">Rapport d’intervention</option>
                  </select>
                </div>}
                <div>
                  <Label htmlFor="doc-number">Numéro</Label>
                  <Input id="doc-number" {...register('number')} />
                  {errors.number && <p className="text-xs text-danger-700">{errors.number.message}</p>}
                </div>
                <div>
                  <Label htmlFor="doc-date">Date</Label>
                  <Input id="doc-date" type="date" {...register('date')} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="references">Références</Label>
                  <Input id="references" {...register('references')} />
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <legend className="font-heading text-sm font-semibold text-navy-900">Destinataire</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="recipient-name">Nom / raison sociale</Label>
                  <Input id="recipient-name" {...register('recipient.name')} />
                  {errors.recipient?.name && <p className="text-xs text-danger-700">{errors.recipient.name.message}</p>}
                </div>
                <div><Label htmlFor="recipient-ice">ICE</Label><Input id="recipient-ice" {...register('recipient.ice')} /></div>
                <div className="sm:col-span-2"><Label htmlFor="recipient-address">Adresse</Label><Input id="recipient-address" {...register('recipient.address')} /></div>
                <div><Label htmlFor="recipient-city">Ville</Label><Input id="recipient-city" {...register('recipient.city')} /></div>
                <div><Label htmlFor="recipient-phone">Téléphone</Label><Input id="recipient-phone" {...register('recipient.phone')} /></div>
                <div className="sm:col-span-2"><Label htmlFor="recipient-email">E-mail</Label><Input id="recipient-email" type="email" {...register('recipient.email')} /></div>
              </div>
            </fieldset>

            {model.type !== 'fiche' && <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-2">
                <legend className="font-heading text-sm font-semibold text-navy-900">Lignes du document</legend>
                <Button type="button" size="sm" variant="outline" onClick={() => lines.append(freshLine(initialModel.issuer.defaultVat))}>
                  <Plus size={14} aria-hidden="true" /> Ajouter une ligne
                </Button>
              </div>
              <div className="space-y-3">
                {lines.fields.map((field, index) => (
                  <Card key={field.id} className="space-y-3 border-slate-200 bg-slate-50/60 p-3 shadow-none">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-700">Ligne {index + 1}</p>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" aria-label="Monter la ligne" disabled={index === 0} onClick={() => moveLine(index, -1)}><ArrowLeft size={14} className="rotate-90" /></Button>
                        <Button type="button" variant="ghost" size="sm" aria-label="Descendre la ligne" disabled={index === lines.fields.length - 1} onClick={() => moveLine(index, 1)}><ArrowDown size={14} /></Button>
                        <Button type="button" variant="ghost" size="sm" aria-label="Dupliquer la ligne" onClick={() => duplicateLine(index)}><Copy size={14} /></Button>
                        <Button type="button" variant="ghost" size="sm" aria-label="Supprimer la ligne" onClick={() => lines.remove(index)}><Trash2 size={14} /></Button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`line-${index}-designation`}>Désignation</Label>
                      <Input id={`line-${index}-designation`} {...register(`lines.${index}.designation`)} />
                      {errors.lines?.[index]?.designation && <p className="text-xs text-danger-700">{errors.lines[index].designation.message}</p>}
                    </div>
                    <div><Label htmlFor={`line-${index}-description`}>Description</Label><Textarea id={`line-${index}-description`} rows={2} {...register(`lines.${index}.description`)} /></div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div><Label htmlFor={`line-${index}-quantity`}>Quantité</Label><Input id={`line-${index}-quantity`} type="number" step="0.01" {...register(`lines.${index}.quantity`, { valueAsNumber: true })} /></div>
                      <div><Label htmlFor={`line-${index}-unit`}>Unité</Label><Input id={`line-${index}-unit`} {...register(`lines.${index}.unit`)} /></div>
                      {!isPriceFreeDelivery && <>
                        <div><Label htmlFor={`line-${index}-price`}>Prix HT</Label><Input id={`line-${index}-price`} type="number" step="0.01" {...register(`lines.${index}.unitPriceHT`, { valueAsNumber: true })} /></div>
                        <div><Label htmlFor={`line-${index}-discount`}>Remise %</Label><Input id={`line-${index}-discount`} type="number" step="0.01" {...register(`lines.${index}.discountPercent`, { valueAsNumber: true })} /></div>
                        <div><Label htmlFor={`line-${index}-vat`}>TVA %</Label><Input id={`line-${index}-vat`} type="number" step="0.01" {...register(`lines.${index}.vatPercent`, { valueAsNumber: true })} /></div>
                      </>}
                    </div>
                  </Card>
                ))}
              </div>
              {!isPriceFreeDelivery && <div className="rounded-xl bg-navy-50 p-3 text-right text-xs text-slate-600">
                <p>Total HT : <strong>{formatMoney(totals.totalHT)}</strong></p>
                <p>TVA : <strong>{formatMoney(totals.totalVAT)}</strong></p>
                <p className="mt-1 text-sm text-navy-900">Total TTC : <strong>{formatMoney(totals.totalTTC)}</strong></p>
              </div>}
            </fieldset>}

            {model.type !== 'fiche' && <fieldset className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
              <legend className="mb-3 font-heading text-sm font-semibold text-navy-900">Conditions</legend>
              <div><Label htmlFor="payment">Mode de paiement</Label><Input id="payment" {...register('paymentMethod')} /></div>
              <div><Label htmlFor="delivery">Délai</Label><Input id="delivery" {...register('deliveryTime')} /></div>
              <div className="sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" {...register('notes')} /></div>
              <div className="sm:col-span-2"><Label htmlFor="conditions">Conditions générales</Label><Textarea id="conditions" {...register('conditions')} /></div>
            </fieldset>}

            <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-2">
                <legend className="font-heading text-sm font-semibold text-navy-900">Sections complémentaires</legend>
                <Button type="button" size="sm" variant="outline" onClick={() => sections.append({ id: crypto.randomUUID(), title: '', content: '', kind: model.type === 'fiche' ? 'fields' : 'text', fields: [], checks: [], table: { columns: ['Colonne 1', 'Colonne 2'], rows: [] } })}>
                  <Plus size={14} aria-hidden="true" /> Ajouter
                </Button>
              </div>
              {sections.fields.map((field, index) => (
                <Card key={field.id} className="space-y-2 border-slate-200 p-3 shadow-none">
                  <div className="flex gap-2">
                    <Input aria-label="Titre de section" placeholder="Titre de la section" {...register(`sections.${index}.title`)} />
                    <Button type="button" variant="ghost" aria-label="Monter la section" disabled={index === 0} onClick={() => sections.move(index, index - 1)}><ArrowLeft size={14} className="rotate-90" /></Button>
                    <Button type="button" variant="ghost" aria-label="Descendre la section" disabled={index === sections.fields.length - 1} onClick={() => sections.move(index, index + 1)}><ArrowDown size={14} /></Button>
                    <Button type="button" variant="ghost" aria-label="Supprimer la section" onClick={() => sections.remove(index)}><Trash2 size={15} /></Button>
                  </div>
                  {model.type === 'fiche' && <select aria-label="Type de contenu" className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" {...register(`sections.${index}.kind`)}><option value="fields">Champs en grille</option><option value="table">Tableau</option><option value="checklist">Cases à cocher</option><option value="text">Texte libre</option></select>}
                  {(model.type !== 'fiche' || model.sections[index]?.kind === 'text' || !model.sections[index]?.kind) && <Textarea aria-label="Contenu de section" placeholder="Contenu" {...register(`sections.${index}.content`)} />}
                  {model.type === 'fiche' && model.sections[index]?.kind === 'fields' && <div className="space-y-2">
                    {(model.sections[index]?.fields ?? []).map((item, fieldIndex) => <div key={item.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2">
                      <Input aria-label="Libellé" placeholder="Libellé" {...register(`sections.${index}.fields.${fieldIndex}.label`)} />
                      <Input aria-label="Valeur" placeholder="Valeur" {...register(`sections.${index}.fields.${fieldIndex}.value`)} />
                      <Button type="button" variant="ghost" aria-label="Monter le champ" disabled={fieldIndex === 0} onClick={() => {
                        const next = [...(getValues(`sections.${index}.fields`) ?? [])]
                        ;[next[fieldIndex - 1], next[fieldIndex]] = [next[fieldIndex], next[fieldIndex - 1]]
                        setValue(`sections.${index}.fields` as Path<DocumentModel>, next, { shouldDirty: true })
                      }}><ArrowLeft size={14} className="rotate-90" /></Button>
                      <Button type="button" variant="ghost" aria-label="Descendre le champ" disabled={fieldIndex === (model.sections[index]?.fields?.length ?? 0) - 1} onClick={() => {
                        const next = [...(getValues(`sections.${index}.fields`) ?? [])]
                        ;[next[fieldIndex], next[fieldIndex + 1]] = [next[fieldIndex + 1], next[fieldIndex]]
                        setValue(`sections.${index}.fields` as Path<DocumentModel>, next, { shouldDirty: true })
                      }}><ArrowDown size={14} /></Button>
                      <Button type="button" variant="ghost" aria-label="Supprimer le champ" onClick={() => {
                        const next = [...(getValues(`sections.${index}.fields`) ?? [])]
                        next.splice(fieldIndex, 1)
                        setValue(`sections.${index}.fields` as Path<DocumentModel>, next, { shouldDirty: true })
                      }}><Trash2 size={14} /></Button>
                    </div>)}
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      const next = [...(getValues(`sections.${index}.fields`) ?? []), { id: crypto.randomUUID(), label: '', value: '' }]
                      setValue(`sections.${index}.fields` as Path<DocumentModel>, next, { shouldDirty: true })
                    }}><Plus size={14} /> Ajouter un champ</Button>
                  </div>}
                  {model.type === 'fiche' && model.sections[index]?.kind === 'table' && <div className="space-y-2">
                    <Textarea aria-label="Colonnes du tableau" placeholder="Colonnes (séparées par des tabulations)" value={model.sections[index]?.table?.columns.join('\t') ?? ''} onChange={(event) => {
                      const table = getValues(`sections.${index}.table`) ?? { columns: [], rows: [] }
                      setValue(`sections.${index}.table` as Path<DocumentModel>, { ...table, columns: event.currentTarget.value.split('\t') }, { shouldDirty: true })
                    }} />
                    <Textarea aria-label="Lignes du tableau" placeholder="Une ligne par rangée, cellules séparées par des tabulations" value={model.sections[index]?.table?.rows.map((row) => row.join('\t')).join('\n') ?? ''} onChange={(event) => {
                      const table = getValues(`sections.${index}.table`) ?? { columns: [], rows: [] }
                      const rows = event.currentTarget.value.split('\n').filter(Boolean).map((row) => row.split('\t'))
                      setValue(`sections.${index}.table` as Path<DocumentModel>, { ...table, rows }, { shouldDirty: true })
                    }} />
                  </div>}
                  {model.type === 'fiche' && model.sections[index]?.kind === 'checklist' && <div className="space-y-2">
                    {(model.sections[index]?.checks ?? []).map((check, checkIndex) => <div className="flex items-center gap-2" key={check.id}>
                      <input type="checkbox" aria-label="Cocher l’élément" checked={check.checked} onChange={(event) => {
                        const next = [...(getValues(`sections.${index}.checks`) ?? [])]
                        next[checkIndex] = { ...next[checkIndex], checked: event.currentTarget.checked }
                        setValue(`sections.${index}.checks` as Path<DocumentModel>, next, { shouldDirty: true })
                      }} />
                      <Input aria-label="Libellé de la case" value={check.label} onChange={(event) => {
                        const next = [...(getValues(`sections.${index}.checks`) ?? [])]
                        next[checkIndex] = { ...next[checkIndex], label: event.currentTarget.value }
                        setValue(`sections.${index}.checks` as Path<DocumentModel>, next, { shouldDirty: true })
                      }} />
                      <Button type="button" variant="ghost" aria-label="Supprimer la case" onClick={() => {
                        const next = [...(getValues(`sections.${index}.checks`) ?? [])]
                        next.splice(checkIndex, 1)
                        setValue(`sections.${index}.checks` as Path<DocumentModel>, next, { shouldDirty: true })
                      }}><Trash2 size={14} /></Button>
                    </div>)}
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      const next = [...(getValues(`sections.${index}.checks`) ?? []), { id: crypto.randomUUID(), label: '', checked: false }]
                      setValue(`sections.${index}.checks` as Path<DocumentModel>, next, { shouldDirty: true })
                    }}><Plus size={14} /> Ajouter une case</Button>
                  </div>}
                </Card>
              ))}
            </fieldset>

            <fieldset className="space-y-3 border-t border-slate-100 pt-5">
              <legend className="mb-3 font-heading text-sm font-semibold text-navy-900">Options de rendu</legend>
              <div className="flex flex-wrap gap-2">
                <OptionToggle label="Logo" checked={model.options.showLogo} onChange={(value) => updateOption('showLogo', value)} />
                <OptionToggle label="Cachet" checked={model.options.showStamp} onChange={(value) => updateOption('showStamp', value)} />
                <OptionToggle label="Signature" checked={model.options.showSignature} onChange={(value) => updateOption('showSignature', value)} />
                <OptionToggle label="Coordonnées bancaires" checked={model.options.showBankDetails} onChange={(value) => updateOption('showBankDetails', value)} />
                {!isPriceFreeDelivery && <OptionToggle label="Montant en lettres" checked={model.options.showAmountInWords} onChange={(value) => updateOption('showAmountInWords', value)} />}
                {model.watermarkText
                  ? <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">Filigrane obligatoire : {model.watermarkText}</p>
                  : <OptionToggle label="Filigrane BROUILLON" checked={model.options.showWatermark} onChange={(value) => updateOption('showWatermark', value)} />}
                <OptionToggle label="Mentions légales" checked={model.options.showLegalMentions} onChange={(value) => updateOption('showLegalMentions', value)} />
                <OptionToggle label="Slogan" checked={model.options.showSlogan} onChange={(value) => updateOption('showSlogan', value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="accent-color">Couleur d’accent</Label>
                  <Input id="accent-color" type="color" className="h-11 p-1" value={model.options.accentColor} onChange={(event) => setValue('options.accentColor', event.currentTarget.value.toUpperCase(), { shouldDirty: true })} />
                </div>
                <div>
                  <Label htmlFor="orientation">Orientation</Label>
                  <select id="orientation" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm" {...register('options.orientation')}>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Paysage</option>
                  </select>
                </div>
              </div>
            </fieldset>
          </form>
        </Card>

        <Card className={`sticky top-24 min-w-0 overflow-hidden shadow-soft ${mobileTab === 'edit' ? 'hidden md:block' : ''}`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy-900">
              <Eye size={16} aria-hidden="true" />
              Aperçu PDF
            </div>
            {previewLoading && <LoaderCircle size={16} className="animate-spin text-gold-600" aria-label="Mise à jour de l’aperçu" />}
          </div>
          <div className="relative min-h-[65vh] bg-slate-100 p-2 sm:p-4">
            {previewError ? (
              <div className="flex min-h-[60vh] items-center justify-center text-sm text-danger-700">{previewError}</div>
            ) : previewUrl ? (
              <iframe
                title="Aperçu du document PDF"
                src={previewUrl}
                className="min-h-[65vh] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
              />
            ) : (
              <div className="flex min-h-[60vh] animate-pulse items-center justify-center rounded-lg border border-slate-200 bg-white">
                <p className="text-sm text-slate-400">Préparation de l’aperçu…</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
