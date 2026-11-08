import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch, type Path } from 'react-hook-form'
import { Button, Input, Label, Select, Textarea } from '@/components/ui'
import { useFournisseurs } from '@/features/fournisseurs/useFournisseurs'
import { articleUnits, articleUnitLabels, type Article, type ArticleInput } from './types'
import { z } from 'zod'

const articleFormSchema = z.object({
  reference: z.string(),
  designation: z.string().trim().min(2, 'La désignation doit contenir au moins 2 caractères.'),
  categorie: z.string(),
  description: z.string(),
  unite: z.enum(articleUnits),
  prixAchatMad: z.number().finite().min(0, 'Le prix d’achat ne peut pas être négatif.'),
  prixVenteMad: z.number().finite().min(0, 'Le prix de vente ne peut pas être négatif.'),
  tauxTva: z.number().finite().min(0).max(100),
  suiviStock: z.boolean(),
  seuilAlerte: z.string(),
  seuilMax: z.string(),
  emplacementHabituel: z.string(),
  fournisseurPrincipalId: z.string(),
})

type ArticleFormValues = z.infer<typeof articleFormSchema>

export function ArticleForm({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial?: Article
  busy: boolean
  onCancel: () => void
  onSave: (values: ArticleInput) => void
}) {
  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleFormSchema),
    defaultValues: initial
      ? {
          reference: initial.reference,
          designation: initial.designation,
          categorie: initial.categorie,
          description: initial.description,
          unite: initial.unite,
          prixAchatMad: initial.prixAchatCents / 100,
          prixVenteMad: initial.prixVenteCents / 100,
          tauxTva: initial.tauxTva,
          suiviStock: initial.suiviStock,
          seuilAlerte: initial.seuilAlerte === undefined ? '' : String(initial.seuilAlerte),
          seuilMax: initial.seuilMax === undefined ? '' : String(initial.seuilMax),
          emplacementHabituel: initial.emplacementHabituel ?? '',
          fournisseurPrincipalId: initial.fournisseurPrincipalId ?? '',
        }
      : {
          reference: '',
          designation: '',
          categorie: '',
          description: '',
          unite: 'piece',
          prixAchatMad: 0,
          prixVenteMad: 0,
          tauxTva: 20,
          suiviStock: false,
          seuilAlerte: '',
          seuilMax: '',
          emplacementHabituel: '',
          fournisseurPrincipalId: '',
        },
  })
  const isStockTracked = useWatch({ control: form.control, name: 'suiviStock' })
  const { data: suppliers = [] } = useFournisseurs()

  const textField = (name: keyof ArticleFormValues, label: string, type = 'text') => (
    <div>
      <Label htmlFor={`article-${name}`}>{label}</Label>
      <Input
        id={`article-${name}`}
        type={type}
        step={type === 'number' ? '0.01' : undefined}
        {...form.register(name as Path<ArticleFormValues>, type === 'number' ? { valueAsNumber: true } : undefined)}
      />
      {form.formState.errors[name]?.message && <p className="mt-1 text-xs text-danger-700">{form.formState.errors[name]?.message}</p>}
    </div>
  )

  return (
    <form className="space-y-5" onSubmit={form.handleSubmit((values) => onSave({
      reference: values.reference.trim(),
      designation: values.designation.trim(),
      categorie: values.categorie.trim(),
      description: values.description,
      unite: values.unite,
      prixAchatCents: Math.round(values.prixAchatMad * 100),
      prixVenteCents: Math.round(values.prixVenteMad * 100),
      tauxTva: values.tauxTva,
      suiviStock: values.suiviStock,
      seuilAlerte: values.seuilAlerte === '' ? undefined : Number(values.seuilAlerte),
      seuilMax: values.seuilMax === '' ? undefined : Number(values.seuilMax),
      emplacementHabituel: values.emplacementHabituel.trim(),
      fournisseurPrincipalId: values.fournisseurPrincipalId.trim(),
      archive: initial?.archive ?? false,
    }))}>
      <section className="grid gap-3 sm:grid-cols-2">
        {textField('designation', 'Désignation')}
        {textField('reference', 'Référence')}
        {textField('categorie', 'Catégorie')}
        <div>
          <Label htmlFor="article-unite">Unité</Label>
          <Select id="article-unite" {...form.register('unite')}>
            {articleUnits.map((unit) => <option key={unit} value={unit}>{articleUnitLabels[unit]}</option>)}
          </Select>
        </div>
        {textField('prixAchatMad', 'Prix d’achat (MAD)', 'number')}
        {textField('prixVenteMad', 'Prix de vente (MAD)', 'number')}
        {textField('tauxTva', 'TVA (%)', 'number')}
      </section>
      <div>
        <Label htmlFor="article-description">Description</Label>
        <Textarea id="article-description" rows={3} {...form.register('description')} />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...form.register('suiviStock')} />
        Article suivi en stock
      </label>
      {isStockTracked && <section className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <h3 className="font-semibold text-navy-900 sm:col-span-2">Suivi de stock</h3>
        <div><Label htmlFor="article-seuilAlerte">Seuil d’alerte</Label><Input id="article-seuilAlerte" min="0" step="0.001" type="number" {...form.register('seuilAlerte')} /></div>
        <div><Label htmlFor="article-seuilMax">Seuil maximum</Label><Input id="article-seuilMax" min="0" step="0.001" type="number" {...form.register('seuilMax')} /></div>
        <div className="sm:col-span-2"><Label htmlFor="article-emplacement">Emplacement habituel</Label><Input id="article-emplacement" {...form.register('emplacementHabituel')} /></div>
        <div className="sm:col-span-2">
          <Label htmlFor="article-supplier">Fournisseur principal</Label>
          <Select id="article-supplier" {...form.register('fournisseurPrincipalId')}>
            <option value="">Aucun fournisseur défini</option>
            {suppliers.filter((supplier) => !supplier.archive).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.code} · {supplier.raisonSociale}</option>
            ))}
          </Select>
        </div>
      </section>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={busy}>Enregistrer l’article</Button>
      </div>
    </form>
  )
}
