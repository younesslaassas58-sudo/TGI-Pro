import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form'
import {
  Building2,
  FileText,
  ImagePlus,
  Landmark,
  Palette,
  Plus,
  Save,
  Settings2,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { doc, setDoc } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Button, Card, Input, Label, Select, Textarea, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { db } from '@/lib/firebase'
import { usePermission } from '@/features/auth/usePermission'
import { documentNumberLabels } from './defaults'
import { useCompanySettings } from './useCompanySettings'
import type { CompanyImageKind, CompanySettings } from './types'

const optionalEmail = z.union([
  z.string().email('Saisissez une adresse e-mail valide.'),
  z.literal(''),
])
const phoneSchema = z
  .string()
  .trim()
  .refine((value) => !value || /^[+\d][\d\s().-]{5,24}$/.test(value), 'Saisissez un numéro valide.')

const settingsSchema = z.object({
  legalName: z.string().trim().min(1, 'La raison sociale est obligatoire.'),
  tradeName: z.string().trim().min(1, 'Le nom commercial est obligatoire.'),
  slogan: z.string(),
  legalForm: z.string(),
  capital: z.string(),
  address: z.string(),
  city: z.string(),
  postalCode: z.string(),
  country: z.string(),
  phones: z.array(phoneSchema),
  email: optionalEmail,
  website: z.string().url('Saisissez une adresse web valide.').or(z.literal('')),
  ice: z.string().refine((value) => !value || /^\d{15}$/.test(value), 'L’ICE doit contenir 15 chiffres.'),
  rc: z.string(),
  tribunal: z.string(),
  taxId: z.string(),
  patente: z.string(),
  cnss: z.string(),
  defaultVat: z.number().min(0).max(100),
  legalMentions: z.string(),
  bankAccounts: z.array(
    z.object({
      id: z.string(),
      bank: z.string(),
      holder: z.string(),
      rib: z.string(),
      iban: z.string(),
      swift: z.string(),
      isDefault: z.boolean(),
    }),
  ),
  images: z.object({
    logo: z.string().optional(),
    stamp: z.string().optional(),
    signature: z.string().optional(),
  }),
  documentAppearance: z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(['Helvetica', 'Times-Roman', 'Courier']),
    headerLogoPosition: z.enum(['gauche', 'droite']),
    showSlogan: z.boolean(),
    showStamp: z.boolean(),
    showSignature: z.boolean(),
    showBankDetails: z.boolean(),
    showLegalMentions: z.boolean(),
  }),
  numbering: z.object({
    devis: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    commande: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    livraison: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    facture: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    recu: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    intervention: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    client: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    ascenseur: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    fiche_client: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    fiche_ascenseur: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    technicien: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
    fiche_technicien: z.object({ prefix: z.string().min(1), format: z.string().min(1), counterLength: z.number().int().min(1).max(10), year: z.number().int().min(2000).max(9999) }),
  }),
})

type SettingsTab = 'identity' | 'legal' | 'bank' | 'images' | 'appearance' | 'numbering'

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Building2 }> = [
  { id: 'identity', label: 'Identité', icon: Building2 },
  { id: 'legal', label: 'Légal & fiscal', icon: FileText },
  { id: 'bank', label: 'Banque', icon: Landmark },
  { id: 'images', label: 'Images', icon: ImagePlus },
  { id: 'appearance', label: 'Documents', icon: Palette },
  { id: 'numbering', label: 'Numérotation', icon: Settings2 },
]

function Field({
  label,
  name,
  register,
  error,
  type = 'text',
  placeholder,
}: {
  label: string
  name: FieldPath<CompanySettings>
  register: ReturnType<typeof useForm<CompanySettings>>['register']
  error?: string
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        {...register(name, name === 'defaultVat' ? { valueAsNumber: true } : undefined)}
      />
      {error && <p className="mt-1 text-xs text-danger-700">{error}</p>}
    </div>
  )
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-gold-200">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-navy-900"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  )
}

function fileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('La lecture de l’image a échoué.'))
    }
    reader.onerror = () => reject(new Error('La lecture de l’image a échoué.'))
    reader.readAsDataURL(file)
  })
}

async function compressCompanyImage(file: File, kind: CompanyImageKind): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez un fichier image valide.')
  const maxWidth = kind === 'logo' ? 600 : 400
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error('Impossible de lire cette image.')
    }

    const scale = Math.min(1, maxWidth / image.naturalWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('La préparation de l’image a échoué.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (let factor = 1; factor >= 0.25; factor -= 0.15) {
      if (factor < 1) {
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale * factor))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale * factor))
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (blob && blob.size < 150 * 1024) return fileAsDataUrl(blob)
    }
    throw new Error('Cette image ne peut pas être compressée sous 150 Ko en PNG.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function CompanySettingsPage() {
  const canEdit = usePermission('parametres', 'modifier')
  const { settings, isLoading, error, refetch } = useCompanySettings()
  const toast = useToast()
  const [tab, setTab] = useState<SettingsTab>('identity')
  const [saving, setSaving] = useState(false)
  const [imageLoading, setImageLoading] = useState<CompanyImageKind | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const activeImageKind = useRef<CompanyImageKind>('logo')
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<CompanySettings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })
  const banks = useFieldArray({ control, name: 'bankAccounts' })
  useWatch({ control })
  const phoneValues = useWatch({ control, name: 'phones' }) ?? []
  const values = getValues()

  useEffect(() => {
    reset(settings)
  }, [reset, settings])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  async function save(valuesToSave: CompanySettings) {
    setSaving(true)
    try {
      await setDoc(doc(db, 'settings', 'company'), valuesToSave)
      await refetch()
      toast.success('Les paramètres de la société ont été enregistrés.')
    } catch {
      toast.error('Impossible d’enregistrer les paramètres. Vérifiez votre connexion et vos droits.')
    } finally {
      setSaving(false)
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    const kind = activeImageKind.current
    if (!file) return
    setImageLoading(kind)
    try {
      const dataUrl = await compressCompanyImage(file, kind)
      setValue(`images.${kind}`, dataUrl, { shouldDirty: true })
      toast.success('L’image est prête. Enregistrez pour appliquer la modification.')
    } catch (imageError: unknown) {
      toast.error(imageError instanceof Error ? imageError.message : 'La préparation de l’image a échoué.')
    } finally {
      setImageLoading(null)
    }
  }

  function chooseImage(kind: CompanyImageKind) {
    activeImageKind.current = kind
    imageInput.current?.click()
  }

  if (!canEdit) {
    return (
      <Card className="p-8 text-sm text-slate-600">
        Seul le directeur peut modifier les paramètres de la société.
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
        <Card className="h-96 animate-pulse bg-slate-100 p-6" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 text-sm text-danger-700">
        Impossible de charger les paramètres de la société.
      </Card>
    )
  }

  const setBooleanValue = (name: keyof CompanySettings['documentAppearance'], value: boolean) =>
    setValue(`documentAppearance.${name}`, value, { shouldDirty: true })

  return (
    <>
      <PageHeader
        title="Paramètres de la société"
        description="Les informations ci-dessous seront reprises dans les documents TGI."
        action={
          <div className="flex flex-wrap gap-3">
            {canEdit && <Link
              to="/utilisateurs"
              className="inline-flex items-center gap-2 text-xs font-semibold text-navy-700 transition hover:text-gold-700"
            >
              <Users size={15} aria-hidden="true" /> Gérer les utilisateurs
            </Link>}
            <Link
              to="/documents/demo"
              className="text-xs font-semibold text-navy-700 transition hover:text-gold-700"
            >
              Ouvrir le document de démonstration →
            </Link>
          </div>
        }
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Choisir une image de société"
        onChange={onImageChange}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 overflow-hidden border-slate-200/80 shadow-soft">
          <div className="overflow-x-auto border-b border-slate-200 px-3 sm:px-5">
            <div className="flex min-w-max gap-1">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`inline-flex min-h-14 items-center gap-2 border-b-2 px-3 text-xs font-semibold transition sm:px-4 ${
                    tab === id
                      ? 'border-gold-500 text-navy-900'
                      : 'border-transparent text-slate-500 hover:text-navy-800'
                  }`}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => setTab(id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(save)}>
            <div className="space-y-6 p-5 sm:p-7">
              {tab === 'identity' && (
                <section className="grid gap-4 sm:grid-cols-2" aria-label="Identité de la société">
                  <Field label="Raison sociale" name="legalName" register={register} error={errors.legalName?.message} />
                  <Field label="Nom commercial" name="tradeName" register={register} error={errors.tradeName?.message} />
                  <Field label="Slogan" name="slogan" register={register} />
                  <Field label="Forme juridique" name="legalForm" register={register} />
                  <Field label="Capital" name="capital" register={register} placeholder="Ex. 1 000 000 MAD" />
                  <Field label="Adresse" name="address" register={register} />
                  <Field label="Ville" name="city" register={register} />
                  <Field label="Code postal" name="postalCode" register={register} />
                  <Field label="Pays" name="country" register={register} />
                  <Field label="E-mail" name="email" register={register} type="email" error={errors.email?.message} />
                  <Field label="Site web" name="website" register={register} type="url" error={errors.website?.message} />
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Téléphones</Label>
                    {phoneValues.map((_, index) => (
                      <div key={`phone-${index}`} className="flex gap-2">
                        <Input
                          type="tel"
                          aria-label={`Téléphone ${index + 1}`}
                          placeholder="+212 5 00 00 00 00"
                          {...register(`phones.${index}`)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Supprimer le téléphone ${index + 1}`}
                          onClick={() => setValue('phones', phoneValues.filter((_, phoneIndex) => phoneIndex !== index), { shouldDirty: true })}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => setValue('phones', [...phoneValues, ''], { shouldDirty: true })}>
                      <Plus size={15} aria-hidden="true" /> Ajouter un téléphone
                    </Button>
                  </div>
                </section>
              )}

              {tab === 'legal' && (
                <section className="grid gap-4 sm:grid-cols-2" aria-label="Informations légales et fiscales">
                  <Field label="ICE (15 chiffres)" name="ice" register={register} error={errors.ice?.message} />
                  <Field label="Registre de commerce (RC)" name="rc" register={register} />
                  <Field label="Tribunal" name="tribunal" register={register} />
                  <Field label="Identifiant fiscal (IF)" name="taxId" register={register} />
                  <Field label="Patente" name="patente" register={register} />
                  <Field label="CNSS" name="cnss" register={register} />
                  <Field label="TVA par défaut (%)" name="defaultVat" register={register} type="number" error={errors.defaultVat?.message} />
                  <div className="sm:col-span-2">
                    <Label htmlFor="legalMentions">Mentions légales de pied de page</Label>
                    <Textarea id="legalMentions" rows={4} {...register('legalMentions')} />
                  </div>
                </section>
              )}

              {tab === 'bank' && (
                <section className="space-y-4" aria-label="Comptes bancaires">
                  {banks.fields.map((field, index) => (
                    <Card key={field.id} className="space-y-4 border-slate-200 p-4 shadow-none">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-navy-900">
                          Compte bancaire {index + 1}
                        </h3>
                        <Button type="button" variant="ghost" size="sm" aria-label={`Supprimer le compte ${index + 1}`} onClick={() => banks.remove(index)}>
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input aria-label="Banque" placeholder="Banque" {...register(`bankAccounts.${index}.bank`)} />
                        <Input aria-label="Titulaire du compte" placeholder="Titulaire" {...register(`bankAccounts.${index}.holder`)} />
                        <Input aria-label="RIB" placeholder="RIB" {...register(`bankAccounts.${index}.rib`)} />
                        <Input aria-label="IBAN" placeholder="IBAN" {...register(`bankAccounts.${index}.iban`)} />
                        <Input aria-label="SWIFT" placeholder="SWIFT" {...register(`bankAccounts.${index}.swift`)} />
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input type="radio" name="defaultBank" checked={values.bankAccounts[index]?.isDefault ?? false} onChange={() => banks.fields.forEach((_, bankIndex) => setValue(`bankAccounts.${bankIndex}.isDefault`, bankIndex === index, { shouldDirty: true }))} />
                          Compte par défaut
                        </label>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => banks.append({ id: crypto.randomUUID(), bank: '', holder: '', rib: '', iban: '', swift: '', isDefault: banks.fields.length === 0 })}
                  >
                    <Plus size={16} aria-hidden="true" /> Ajouter un compte bancaire
                  </Button>
                </section>
              )}

              {tab === 'images' && (
                <section className="grid gap-4 md:grid-cols-3" aria-label="Images de la société">
                  {([
                    ['logo', 'Logo', 'PNG transparent · largeur maximale 600 px'],
                    ['stamp', 'Cachet', 'PNG · largeur maximale 400 px'],
                    ['signature', 'Signature', 'PNG · largeur maximale 400 px'],
                  ] as const).map(([kind, label, hint]) => (
                    <ImageSetting
                      key={kind}
                      label={label}
                      hint={hint}
                      image={values.images[kind]}
                      loading={imageLoading === kind}
                      onUpload={() => chooseImage(kind)}
                      onRemove={() => setValue(`images.${kind}`, undefined, { shouldDirty: true })}
                    />
                  ))}
                </section>
              )}

              {tab === 'appearance' && (
                <section className="space-y-6" aria-label="Apparence des documents">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField label="Couleur principale" value={values.documentAppearance.primaryColor} onChange={(value) => setValue('documentAppearance.primaryColor', value, { shouldDirty: true })} />
                    <ColorField label="Couleur d’accent" value={values.documentAppearance.accentColor} onChange={(value) => setValue('documentAppearance.accentColor', value, { shouldDirty: true })} />
                    <div>
                      <Label htmlFor="font">Police des documents</Label>
                      <Select id="font" {...register('documentAppearance.font')}>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times-Roman">Times</option>
                        <option value="Courier">Courier</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="logoPosition">Disposition du logo</Label>
                      <Select id="logoPosition" {...register('documentAppearance.headerLogoPosition')}>
                        <option value="gauche">Logo à gauche</option>
                        <option value="droite">Logo à droite</option>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ToggleField label="Afficher le slogan" checked={values.documentAppearance.showSlogan} onChange={(value) => setBooleanValue('showSlogan', value)} />
                    <ToggleField label="Afficher le cachet" checked={values.documentAppearance.showStamp} onChange={(value) => setBooleanValue('showStamp', value)} />
                    <ToggleField label="Afficher la signature" checked={values.documentAppearance.showSignature} onChange={(value) => setBooleanValue('showSignature', value)} />
                    <ToggleField label="Afficher les coordonnées bancaires" checked={values.documentAppearance.showBankDetails} onChange={(value) => setBooleanValue('showBankDetails', value)} />
                    <ToggleField label="Afficher les mentions légales" checked={values.documentAppearance.showLegalMentions} onChange={(value) => setBooleanValue('showLegalMentions', value)} />
                  </div>
                </section>
              )}

              {tab === 'numbering' && (
                <section className="space-y-3" aria-label="Numérotation des documents">
                  {(Object.keys(documentNumberLabels) as Array<keyof typeof documentNumberLabels>).map((type) => (
                    <div key={type} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1.1fr_0.7fr_1.2fr_0.7fr_0.7fr]">
                      <p className="self-center text-sm font-semibold text-navy-900">{documentNumberLabels[type]}</p>
                      <div>
                        <Label htmlFor={`${type}-prefix`}>Préfixe</Label>
                        <Input id={`${type}-prefix`} {...register(`numbering.${type}.prefix`)} />
                      </div>
                      <div>
                        <Label htmlFor={`${type}-format`}>Format</Label>
                        <Input id={`${type}-format`} {...register(`numbering.${type}.format`)} />
                      </div>
                      <div>
                        <Label htmlFor={`${type}-length`}>Compteur</Label>
                        <Input id={`${type}-length`} type="number" {...register(`numbering.${type}.counterLength`, { valueAsNumber: true })} />
                      </div>
                      <div>
                        <Label htmlFor={`${type}-year`}>Année</Label>
                        <Input id={`${type}-year`} type="number" {...register(`numbering.${type}.year`, { valueAsNumber: true })} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">
                    Variables prises en charge : {'{PREFIX}'}, {'{YYYY}'}, {'{NUM}'}.
                  </p>
                </section>
              )}
            </div>

            <div className="sticky bottom-0 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <p className="text-xs text-slate-500">
                {isDirty ? 'Modifications non enregistrées' : 'Tous les paramètres sont enregistrés'}
              </p>
              <Button type="submit" loading={saving} disabled={!isDirty}>
                <Save size={16} aria-hidden="true" /> Enregistrer les paramètres
              </Button>
            </div>
          </form>
        </Card>
        <div className="space-y-4">
          <CompanyDocumentPreview settings={values} />
          <Card className="p-4">
            <p className="text-xs leading-5 text-slate-500">
              Cet aperçu donne une indication de l’en-tête et du pied de page. Les documents générés
              utilisent ces paramètres enregistrés.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

function ImageSetting({
  label,
  hint,
  image,
  loading,
  onUpload,
  onRemove,
}: {
  label: string
  hint: string
  image?: string
  loading: boolean
  onUpload: () => void
  onRemove: () => void
}) {
  return (
    <Card className="flex min-h-60 flex-col p-4 shadow-none">
      <h3 className="text-sm font-semibold text-navy-900">{label}</h3>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <div className="my-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        {image ? (
          <img src={image} alt={`Aperçu ${label.toLowerCase()}`} className="max-h-24 max-w-full object-contain" />
        ) : (
          <ImagePlus size={28} className="text-slate-300" aria-hidden="true" />
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" loading={loading} onClick={onUpload}>
          <Upload size={14} aria-hidden="true" /> {image ? 'Remplacer' : 'Importer'}
        </Button>
        {image && (
          <Button type="button" variant="ghost" size="sm" aria-label={`Supprimer ${label.toLowerCase()}`} onClick={onRemove}>
            <Trash2 size={15} aria-hidden="true" />
          </Button>
        )}
      </div>
    </Card>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label htmlFor={`color-${label}`}>{label}</Label>
      <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-300 bg-white px-3">
        <input
          id={`color-${label}`}
          type="color"
          className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
        />
        <span className="font-mono text-xs font-medium text-slate-600">{value}</span>
      </div>
    </div>
  )
}

function CompanyDocumentPreview({ settings }: { settings: CompanySettings }) {
  const logo = settings.images.logo
  const defaultBank = settings.bankAccounts.find((account) => account.isDefault)
  const logoPreview: ReactNode = logo ? (
    <img src={logo} alt="" className="max-h-12 max-w-28 object-contain" />
  ) : (
    <span className="font-heading text-sm font-bold" style={{ color: settings.documentAppearance.primaryColor }}>
      TGI-Pro
    </span>
  )

  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-soft">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Aperçu du document
        </p>
      </div>
      <div className="m-4 min-h-64 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div
          className={`flex items-start justify-between gap-3 border-b-2 pb-3 ${settings.documentAppearance.headerLogoPosition === 'droite' ? 'flex-row-reverse' : ''}`}
          style={{ borderColor: settings.documentAppearance.accentColor }}
        >
          <div>{logoPreview}</div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: settings.documentAppearance.primaryColor }}>
              {settings.tradeName || 'TGI Ascenseurs'}
            </p>
            {settings.documentAppearance.showSlogan && settings.slogan && (
              <p className="mt-1 text-[8px] text-slate-500">{settings.slogan}</p>
            )}
            <p className="mt-1 text-[8px] text-slate-500">{settings.phones.filter(Boolean).join(' · ')}</p>
            <p className="text-[8px] text-slate-500">{settings.email}</p>
          </div>
        </div>
        <p className="mt-5 text-[8px] font-bold uppercase tracking-wide" style={{ color: settings.documentAppearance.accentColor }}>
          DEVIS · DEV-2026-0001
        </p>
        <div className="mt-2 h-2 w-24 rounded bg-slate-200" />
        <div className="mt-4 space-y-2">
          <div className="h-1.5 w-full rounded bg-slate-100" />
          <div className="h-1.5 w-4/5 rounded bg-slate-100" />
          <div className="h-1.5 w-3/5 rounded bg-slate-100" />
        </div>
        <div className="mt-5 flex justify-end">
          <div className="space-y-1">
            <div className="h-1.5 w-20 rounded bg-slate-100" />
            <div className="h-2 w-24 rounded" style={{ backgroundColor: settings.documentAppearance.primaryColor }} />
          </div>
        </div>
        {(settings.documentAppearance.showBankDetails || settings.documentAppearance.showLegalMentions) && (
          <div className="mt-5 border-t border-slate-200 pt-2 text-[7px] leading-3 text-slate-500">
            {settings.documentAppearance.showBankDetails && defaultBank && (
              <p>{defaultBank.bank} · RIB {defaultBank.rib}</p>
            )}
            {settings.documentAppearance.showLegalMentions && (
              <p>{settings.legalMentions || [settings.ice && `ICE ${settings.ice}`, settings.rc && `RC ${settings.rc}`, settings.taxId && `IF ${settings.taxId}`].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
