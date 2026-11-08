import { useEffect, useMemo, useState } from 'react'
import { useClients } from '@/features/clients/useClients'
import { ClientPicker } from '@/features/clients/ClientPicker'
import { AscenseurPicker } from '@/features/parc/AscenseurPicker'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { TechnicienPicker } from '@/features/techniciens/TechnicienPicker'
import { useTechniciens } from '@/features/techniciens/useTechniciens'
import { useDepots } from '@/features/stock/useStock'
import { StockArticlePicker } from '@/features/stock/StockArticlePicker'
import { usePermission } from '@/features/auth/usePermission'
import { useContrats } from '@/features/recouvrement/useRecouvrement'
import { useDevis } from '@/features/devis/useDevis'
import { Button, Input, Label, Select, Textarea } from '@/components/ui'
import { defaultChecklist, interventionInputSchema, interventionTypeLabels, type Intervention, type InterventionInput } from './types'

const initialForm: InterventionInput = {
  type: 'depannage_urgent',
  priorite: 'normale',
  clientId: '',
  clientNomSnapshot: '',
  ascenseurId: '',
  ascenseurCodeSnapshot: '',
  adresseSiteSnapshot: '',
  contratId: '',
  techniciensIds: [],
  techniciensUids: [],
  technicienPrincipalId: '',
  canalDemande: 'telephone',
  demandeur: { nom: '', telephone: '' },
  personneBloquee: false,
  descriptionDemande: '',
  datePrevue: new Date().toISOString().slice(0, 10),
  heurePrevue: '',
  tempsDeplacementMinutes: 0,
  diagnostic: '',
  travauxRealises: '',
  piecesUtilisees: [],
  checklist: defaultChecklist('depannage_urgent'),
  observations: '',
  recommandations: '',
  etatApresIntervention: 'en_service',
  facturable: true,
  couvertParContrat: false,
  montantEstime: 0,
  devisId: '',
  nomSignataire: '',
  signatureMediaId: '',
  photosMediaIds: [],
}

export function InterventionForm({
  existing,
  initialValues,
  reportOnly = false,
  busy = false,
  onCancel,
  onDirtyChange,
  onSave,
}: {
  existing?: Intervention
  initialValues?: Partial<InterventionInput>
  reportOnly?: boolean
  busy?: boolean
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSave: (input: InterventionInput) => void
}) {
  const originalValues = useMemo<InterventionInput>(() => existing ? {
    ...existing,
    datePrevue: existing.datePrevue.slice(0, 10),
  } : { ...initialForm, ...initialValues }, [existing, initialValues])
  const [values, setValues] = useState<InterventionInput>(originalValues)
  const [formError, setFormError] = useState('')
  useEffect(() => onDirtyChange?.(JSON.stringify(values) !== JSON.stringify(originalValues)), [onDirtyChange, originalValues, values])
  const { data: clients = [] } = useClients()
  const { data: elevators = [] } = useAscenseurs(values.clientId)
  const { data: technicians = [] } = useTechniciens()
  const { data: depots = [] } = useDepots()
  const canViewRecovery = usePermission('recouvrement', 'voir')
  const { data: contracts = [] } = useContrats(canViewRecovery)
  const { data: quotes = [] } = useDevis(canViewRecovery)
  const client = clients.find((item) => item.id === values.clientId)
  const elevator = elevators.find((item) => item.id === values.ascenseurId)
  const technician = technicians.find((item) => item.id === values.technicienPrincipalId)
  const linkedContract = contracts.find((item) => item.id === values.contratId)
  const linkedQuote = quotes.find((item) => item.id === values.devisId)
  const today = new Date().toISOString().slice(0, 10)
  const contractCoversDate = (contract: typeof linkedContract) => Boolean(
    contract && contract.statut === 'actif' && !contract.archive
    && contract.dateDebut <= today && contract.dateFin >= today,
  )
  const clientContracts = contracts.filter((item) => item.clientId === values.clientId
    && item.ascenseursIds.includes(values.ascenseurId) && contractCoversDate(item))
  const clientQuotes = quotes.filter((item) => item.client.id === values.clientId && ['draft', 'sent', 'accepted'].includes(item.status))
  const activeDepots = depots.filter((item) => item.actif && !item.archive)
  const technicianDepot = activeDepots.find((item) => item.type === 'vehicule')
  const choices = useMemo(() => activeDepots.map((item) => ({ id: item.id, name: item.nom })), [activeDepots])

  function change<K extends keyof InterventionInput>(key: K, value: InterventionInput[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function updatePart(id: string, patch: Partial<InterventionInput['piecesUtilisees'][number]>) {
    change('piecesUtilisees', values.piecesUtilisees.map((part) => part.id === id ? { ...part, ...patch } : part))
  }

  function addPart() {
    change('piecesUtilisees', [...values.piecesUtilisees, {
      id: crypto.randomUUID(),
      designation: '',
      quantite: 1,
      unite: 'pièce',
      articleId: '',
      depotId: '',
    }])
  }

  return <form className="max-h-[75vh] space-y-6 overflow-y-auto pr-1" onSubmit={(event) => {
    event.preventDefault()
    if (!client || !elevator) return
    const parsed = interventionInputSchema.safeParse({
      ...values,
      clientNomSnapshot: client.raisonSociale,
      ascenseurCodeSnapshot: elevator.code,
      adresseSiteSnapshot: [elevator.adresseSite, elevator.villeSite].filter(Boolean).join(', '),
      techniciensIds: [...new Set([...values.techniciensIds, ...(technician ? [technician.id] : [])])],
      techniciensUids: [...new Set([...values.techniciensIds, ...(technician ? [technician.id] : [])]
        .map((id) => technicians.find((item) => item.id === id)?.uidCompte ?? '')
        .filter(Boolean))],
      technicienPrincipalId: technician?.id ?? '',
      couvertParContrat: contractCoversDate(linkedContract) && Boolean(linkedContract?.ascenseursIds.includes(values.ascenseurId)),
      montantEstime: linkedQuote?.totals.totalTTCCents ?? values.montantEstime,
      piecesUtilisees: values.piecesUtilisees.filter((part) => part.designation.trim()),
      checklist: values.checklist.length ? values.checklist : defaultChecklist(values.type),
      datePrevue: values.datePrevue,
    })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Vérifiez les données saisies.')
      return
    }
    setFormError('')
    onSave(parsed.data)
  }}>
    {!reportOnly && <section className="space-y-3">
      <h3 className="font-heading font-semibold text-navy-900">Demande et appareil</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="intervention-type">Type</Label><Select id="intervention-type" value={values.type} onChange={(event) => {
          const type = event.currentTarget.value as Intervention['type']
          setValues((current) => ({ ...current, type, checklist: defaultChecklist(type) }))
        }}>{Object.entries(interventionTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
        <div><Label htmlFor="intervention-priority">Priorité</Label><Select id="intervention-priority" value={values.priorite} onChange={(event) => change('priorite', event.currentTarget.value as Intervention['priorite'])}><option value="urgente">Urgente</option><option value="haute">Haute</option><option value="normale">Normale</option><option value="basse">Basse</option></Select></div>
      </div>
      <div><Label>Client</Label><ClientPicker value={values.clientId} onChange={(clientId) => setValues((current) => ({ ...current, clientId, ascenseurId: '', clientNomSnapshot: '', ascenseurCodeSnapshot: '', adresseSiteSnapshot: '' }))} /></div>
      <div><Label>Appareil</Label><AscenseurPicker clientId={values.clientId} value={values.ascenseurId} onChange={(ascenseurId) => {
        const contract = contracts.find((item) => item.clientId === values.clientId && item.ascenseursIds.includes(ascenseurId) && contractCoversDate(item))
        setValues((current) => ({ ...current, ascenseurId, contratId: contract?.id ?? '', couvertParContrat: Boolean(contract) }))
      }} /></div>
      {canViewRecovery && <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="linked-contract">Contrat de maintenance</Label><Select id="linked-contract" value={values.contratId ?? ''} onChange={(event) => {
          const contratId = event.currentTarget.value
          const contract = contracts.find((item) => item.id === contratId)
          setValues((current) => ({ ...current, contratId, couvertParContrat: Boolean(contract) }))
        }}><option value="">Aucun contrat lié</option>{clientContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.numero} · {contract.typePrestation}</option>)}</Select></div>
        <div><Label htmlFor="linked-quote">Devis associé</Label><Select id="linked-quote" value={values.devisId ?? ''} onChange={(event) => {
          const devisId = event.currentTarget.value
          const quote = quotes.find((item) => item.id === devisId)
          setValues((current) => ({ ...current, devisId, montantEstime: quote?.totals.totalTTCCents ?? current.montantEstime }))
        }}><option value="">Aucun devis associé</option>{clientQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} · {quote.status}</option>)}</Select></div>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="intervention-date">Date prévue</Label><Input id="intervention-date" type="date" value={values.datePrevue} onChange={(event) => change('datePrevue', event.currentTarget.value)} required /></div>
        <div><Label htmlFor="intervention-time">Heure prévue</Label><Input id="intervention-time" type="time" value={values.heurePrevue} onChange={(event) => change('heurePrevue', event.currentTarget.value)} /></div>
      </div>
    </section>}

    {!reportOnly && <section className="space-y-3">
      <h3 className="font-heading font-semibold text-navy-900">Affectation et demandeur</h3>
      <TechnicienPicker value={values.technicienPrincipalId} onChange={(id) => {
        change('technicienPrincipalId', id)
        change('techniciensIds', [...new Set([...values.techniciensIds, ...(id ? [id] : [])])])
      }} />
      <fieldset className="space-y-2"><legend className="text-sm font-medium text-slate-700">Équipe affectée</legend><div className="grid gap-2 sm:grid-cols-2">{technicians.filter((item) => item.statut === 'actif' && !item.archive).map((item) => <label key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-sm"><input type="checkbox" checked={values.techniciensIds.includes(item.id) || values.technicienPrincipalId === item.id} onChange={(event) => {
        const selected = event.currentTarget.checked
        change('techniciensIds', selected ? [...new Set([...values.techniciensIds, item.id])] : values.techniciensIds.filter((id) => id !== item.id))
      }} />{item.prenom} {item.nom} · {item.matricule}</label>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="requester-name">Nom du demandeur</Label><Input id="requester-name" value={values.demandeur.nom} onChange={(event) => change('demandeur', { ...values.demandeur, nom: event.currentTarget.value })} /></div>
        <div><Label htmlFor="requester-phone">Téléphone du demandeur</Label><Input id="requester-phone" value={values.demandeur.telephone} onChange={(event) => change('demandeur', { ...values.demandeur, telephone: event.currentTarget.value })} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="request-channel">Canal de demande</Label><Select id="request-channel" value={values.canalDemande} onChange={(event) => change('canalDemande', event.currentTarget.value as Intervention['canalDemande'])}><option value="telephone">Téléphone</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="contrat">Contrat</option><option value="sur_place">Sur place</option></Select></div>
        <label className="flex items-center gap-2 self-end rounded-xl bg-danger-50 p-3 text-sm font-medium text-danger-700"><input type="checkbox" checked={values.personneBloquee} onChange={(event) => change('personneBloquee', event.currentTarget.checked)} />Personne bloquée</label>
      </div>
      <div><Label htmlFor="intervention-description">Description de la demande</Label><Textarea id="intervention-description" value={values.descriptionDemande} onChange={(event) => change('descriptionDemande', event.currentTarget.value)} required /></div>
    </section>}

    <section className="space-y-3">
      <h3 className="font-heading font-semibold text-navy-900">Rapport et pièces</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="diagnostic">Diagnostic</Label><Textarea id="diagnostic" value={values.diagnostic} onChange={(event) => change('diagnostic', event.currentTarget.value)} /></div>
        <div><Label htmlFor="work-done">Travaux réalisés</Label><Textarea id="work-done" value={values.travauxRealises} onChange={(event) => change('travauxRealises', event.currentTarget.value)} /></div>
      </div>
      {values.checklist.length > 0 && <div className="space-y-2">
        <h4 className="text-sm font-semibold">Checklist de sécurité</h4>
        {values.checklist.map((item, index) => <div key={`${item.point}-${index}`} className="grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div><p className="text-sm font-medium">{item.point}</p><Input aria-label={`Commentaire : ${item.point}`} value={item.commentaire} onChange={(event) => change('checklist', values.checklist.map((current, position) => position === index ? { ...current, commentaire: event.currentTarget.value } : current))} placeholder="Commentaire (facultatif)" /></div>
          <Select aria-label={`Résultat : ${item.point}`} value={item.resultat} onChange={(event) => change('checklist', values.checklist.map((current, position) => position === index ? { ...current, resultat: event.currentTarget.value as typeof current.resultat } : current))}><option value="na">Non vérifié</option><option value="ok">Conforme</option><option value="a_surveiller">À surveiller</option><option value="defaut">Défaut constaté</option></Select>
        </div>)}
      </div>}
      <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Pièces utilisées</h4><Button type="button" size="sm" variant="outline" onClick={addPart}>Ajouter une pièce</Button></div>
      {values.piecesUtilisees.map((part) => <div key={part.id} className="space-y-2 rounded-xl border border-slate-200 p-3">
        <StockArticlePicker value={part.articleId ?? ''} depotId={part.depotId || technicianDepot?.id || ''} onChange={(articleId, article) => {
          updatePart(part.id, { articleId, designation: article?.designation ?? part.designation, unite: article?.unite ?? part.unite })
        }} />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Select aria-label="Dépôt de sortie" value={part.depotId} onChange={(event) => updatePart(part.id, { depotId: event.currentTarget.value })}><option value="">Dépôt véhicule par défaut</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Input aria-label="Quantité utilisée" type="number" min="0.001" step="any" value={part.quantite} onChange={(event) => updatePart(part.id, { quantite: Number(event.currentTarget.value) })} />
          <Button type="button" size="sm" variant="danger" onClick={() => change('piecesUtilisees', values.piecesUtilisees.filter((item) => item.id !== part.id))}>Retirer</Button>
        </div>
      </div>)}
      {!reportOnly && <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="after-state">État après intervention</Label><Select id="after-state" value={values.etatApresIntervention} onChange={(event) => change('etatApresIntervention', event.currentTarget.value as Intervention['etatApresIntervention'])}><option value="en_service">En service</option><option value="a_l_arret">À l’arrêt</option><option value="en_panne">En panne</option><option value="en_modernisation">En modernisation</option></Select></div>
        <div><Label htmlFor="travel-time">Temps de déplacement (minutes)</Label><Input id="travel-time" type="number" min="0" value={values.tempsDeplacementMinutes} onChange={(event) => change('tempsDeplacementMinutes', Number(event.currentTarget.value))} /></div>
      </div>}
      {reportOnly && <div><Label htmlFor="after-state">État après intervention</Label><Select id="after-state" value={values.etatApresIntervention} onChange={(event) => change('etatApresIntervention', event.currentTarget.value as Intervention['etatApresIntervention'])}><option value="en_service">En service</option><option value="a_l_arret">À l’arrêt</option><option value="en_panne">En panne</option><option value="en_modernisation">En modernisation</option></Select></div>}
      {!reportOnly && <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" checked={values.facturable} onChange={(event) => change('facturable', event.currentTarget.checked)} />Intervention facturable</label>
        <div><Label htmlFor="estimated-amount">Montant estimé (MAD)</Label><Input id="estimated-amount" type="number" min="0" step="0.01" value={values.montantEstime / 100} onChange={(event) => change('montantEstime', Math.round(Number(event.currentTarget.value) * 100))} /></div>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor="observations">Observations</Label><Textarea id="observations" value={values.observations} onChange={(event) => change('observations', event.currentTarget.value)} /></div>
        <div><Label htmlFor="recommendations">Recommandations</Label><Textarea id="recommendations" value={values.recommandations} onChange={(event) => change('recommandations', event.currentTarget.value)} /></div>
      </div>
      <div><Label htmlFor="signer-name">Nom du signataire client</Label><Input id="signer-name" value={values.nomSignataire} onChange={(event) => change('nomSignataire', event.currentTarget.value)} /></div>
    </section>
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
      {formError && <p role="alert" className="mr-auto self-center text-sm text-danger-700">{formError}</p>}
      <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
      <Button type="submit" loading={busy} disabled={!values.clientId || !values.ascenseurId}>Enregistrer</Button>
    </div>
  </form>
}
