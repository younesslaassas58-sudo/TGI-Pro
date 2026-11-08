import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Banknote, BellRing, FileSpreadsheet, Plus, ReceiptText, RefreshCw, Search, XCircle } from 'lucide-react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { Badge, Button, Card, Input, Modal, Select, Spinner, Textarea, useToast } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePermission } from '@/features/auth/usePermission'
import { ClientPicker } from '@/features/clients/ClientPicker'
import { useClients } from '@/features/clients/useClients'
import type { Client } from '@/features/clients/types'
import { useAscenseurs } from '@/features/parc/useAscenseurs'
import { useAuth } from '@/features/auth/authStore'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { formatDate, formatMoney } from '@/lib/format'
import { getNextNumber } from '@/features/documents/getNextNumber'
import {
  createClientRecoveryStatement,
  createContractScheduleDocument,
  createPaymentReceipt,
  createReminderLetter,
} from './documentModels'
import {
  allocatePaymentAutomatically,
  allocatePaymentManually,
  deriveStatut,
  calculateAgedBalances,
  type DerivedEcheanceStatus,
} from './logic'
import type { ContratInput, Echeance, EcheanceInput, Paiement, PaymentInput, RecouvrementContrat } from './types'
import {
  useAnnulerPaiement,
  useCancelEcheance,
  useContrats,
  useCreateEcheance,
  useCreateRelance,
  useEcheances,
  useEnregistrerPaiement,
  useGenererEcheances,
  useGenererEcheancesActives,
  usePaiements,
  useRelances,
  useSaveContrat,
  useSetContratStatus,
} from './useRecouvrement'

const today = () => new Date().toISOString().slice(0, 10)
const endOfCurrentMonth = () => {
  const date = new Date()
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}
const statusLabels: Record<DerivedEcheanceStatus, string> = {
  a_venir: 'À venir',
  due: 'À échéance',
  partielle: 'Partiellement payée',
  en_retard: 'En retard',
  soldee: 'Soldée',
  annulee: 'Annulée',
}
const statusVariant: Record<DerivedEcheanceStatus, 'success' | 'warning' | 'danger' | 'default'> = {
  a_venir: 'default',
  due: 'warning',
  partielle: 'warning',
  en_retard: 'danger',
  soldee: 'success',
  annulee: 'default',
}
const periods: ContratInput['periodicite'][] = ['mensuel', 'trimestriel', 'semestriel', 'annuel']
const periodLabels: Record<ContratInput['periodicite'], string> = {
  mensuel: 'Mensuel',
  trimestriel: 'Trimestriel',
  semestriel: 'Semestriel',
  annuel: 'Annuel',
}

function ContractEditor({
  existing,
  onClose,
}: {
  existing?: RecouvrementContrat
  onClose: () => void
}) {
  const { data: clients = [] } = useClients()
  const { data: elevators = [] } = useAscenseurs()
  const save = useSaveContrat()
  const toast = useToast()
  const { settings } = useCompanySettings()
  const [clientId, setClientId] = useState(existing?.clientId ?? '')
  const [ascenseursIds, setAscenseursIds] = useState<string[]>(existing?.ascenseursIds ?? [])
  const [periodicite, setPeriodicite] = useState<ContratInput['periodicite']>(existing?.periodicite ?? 'mensuel')
  const [montant, setMontant] = useState(String((existing?.montantPeriodeHT ?? 0) / 100))
  const [tvaPct, setTvaPct] = useState(existing ? String(existing.tvaPct) : '')
  const [dateDebut, setDateDebut] = useState(existing?.dateDebut ?? today())
  const [dateFin, setDateFin] = useState(existing?.dateFin ?? '')
  const [jour, setJour] = useState(String(existing?.jourEcheance ?? 1))
  const [prestation, setPrestation] = useState<ContratInput['typePrestation']>(existing?.typePrestation ?? 'entretien')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [reconduction, setReconduction] = useState(existing?.reconductionTacite ?? true)
  const [mode, setMode] = useState(existing?.modePaiementHabituel ?? '')

  const client = clients.find((item) => item.id === clientId)
  const availableElevators = elevators.filter((item) => item.clientId === clientId && !item.archive)
  const htCents = Math.round((Number(montant.replace(',', '.')) || 0) * 100)
  const tva = Math.max(0, tvaPct === '' ? settings.defaultVat : Number(tvaPct) || 0)
  const ttcCents = Math.round(htCents * (1 + tva / 100))

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) {
      toast.error('Sélectionnez un client.')
      return
    }
    if (dateFin && dateFin < dateDebut) {
      toast.error('La date de fin doit être postérieure à la date de début.')
      return
    }
    const input: ContratInput = {
      clientId,
      client: {
        nom: client.raisonSociale,
        adresse: client.adresse,
        ville: client.ville,
        ice: client.ice,
        telephone: client.telephones[0] ?? '',
        email: client.email,
      },
      ascenseursIds,
      ascenseursCodes: availableElevators.filter((item) => ascenseursIds.includes(item.id)).map((item) => item.code),
      typePrestation: prestation,
      periodicite,
      montantPeriodeHT: htCents,
      tvaPct: tva,
      dateDebut,
      dateFin,
      jourEcheance: jour === 'fin_de_mois' ? 'fin_de_mois' : Math.max(1, Math.min(28, Number(jour) || 1)),
      modePaiementHabituel: mode,
      reconductionTacite: reconduction,
      ...(existing?.indexationPct !== undefined ? { indexationPct: existing.indexationPct } : {}),
      statut: existing?.statut ?? 'actif',
      ...(existing?.dateResiliation ? { dateResiliation: existing.dateResiliation } : {}),
      ...(existing?.motifResiliation ? { motifResiliation: existing.motifResiliation } : {}),
      notes,
      archive: existing?.archive ?? false,
    }
    try {
      await save.mutateAsync({ input, existing })
      toast.success(existing ? 'Contrat mis à jour.' : 'Contrat créé.')
      onClose()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le contrat.')
    }
  }

  return (
    <form className="max-h-[78vh] space-y-4 overflow-y-auto p-1" onSubmit={(event) => void submit(event)}>
      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-navy-900">Client et appareils</h3>
        <ClientPicker value={clientId} onChange={(value) => { setClientId(value); setAscenseursIds([]) }} />
        <div className="grid gap-2 sm:grid-cols-2">
          {availableElevators.map((elevator) => (
            <label key={elevator.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <input type="checkbox" checked={ascenseursIds.includes(elevator.id)} onChange={(event) => setAscenseursIds((ids) => event.currentTarget.checked ? [...ids, elevator.id] : ids.filter((id) => id !== elevator.id))} />
              {elevator.code} · {elevator.marque} {elevator.modele}
            </label>
          ))}
          {clientId && availableElevators.length === 0 && <p className="text-sm text-slate-500">Aucun appareil disponible pour ce client.</p>}
        </div>
      </section>
      <section className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">Type de prestation<Select value={prestation} onChange={(event) => setPrestation(event.currentTarget.value as ContratInput['typePrestation'])}><option value="entretien">Entretien</option><option value="maintenance_complete">Maintenance complète</option><option value="autre">Autre</option></Select></label>
        <label className="space-y-1 text-sm">Périodicité<Select value={periodicite} onChange={(event) => setPeriodicite(event.currentTarget.value as ContratInput['periodicite'])}>{periods.map((item) => <option key={item} value={item}>{periodLabels[item]}</option>)}</Select></label>
        <label className="space-y-1 text-sm">Montant par période HT (MAD)<Input required min="0" step="0.01" type="number" value={montant} onChange={(event) => setMontant(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">TVA (%)<Input required min="0" max="100" step="0.01" type="number" value={tvaPct || String(settings.defaultVat)} onChange={(event) => setTvaPct(event.currentTarget.value)} /></label>
        <p className="sm:col-span-2 text-sm font-semibold">Montant TTC par période : {formatMoney(ttcCents / 100)}</p>
        <label className="space-y-1 text-sm">Date de début<Input required type="date" value={dateDebut} onChange={(event) => setDateDebut(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">Date de fin (facultative)<Input type="date" value={dateFin} onChange={(event) => setDateFin(event.currentTarget.value)} /></label>
        <label className="space-y-1 text-sm">Jour d’échéance<Select value={jour} onChange={(event) => setJour(event.currentTarget.value)}><option value="fin_de_mois">Fin de mois</option>{Array.from({ length: 28 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</Select></label>
        <label className="space-y-1 text-sm">Mode de paiement habituel<Input value={mode} onChange={(event) => setMode(event.currentTarget.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reconduction} onChange={(event) => setReconduction(event.currentTarget.checked)} /> Reconduction tacite</label>
        <label className="space-y-1 text-sm sm:col-span-2">Notes<Textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} /></label>
      </section>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={save.isPending}>Enregistrer le contrat</Button></div>
    </form>
  )
}

function statusFor(echeance: Echeance): DerivedEcheanceStatus {
  return deriveStatut(echeance, today())
}

function sortRows<T>(rows: T[], compare: (left: T, right: T) => number): T[] {
  return [...rows].sort(compare)
}

export function RecouvrementPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clientId, contratId } = useParams()
  const toast = useToast()
  const profile = useAuth((state) => state.profile)
  const { settings } = useCompanySettings()
  const canCreate = usePermission('recouvrement', 'creer')
  const canEdit = usePermission('recouvrement', 'modifier')
  const isDirector = profile?.role === 'directeur'
  const { data: clients = [], isLoading: clientsLoading, error: clientsError } = useClients()
  const { data: contrats = [], isLoading: contratsLoading, error: contratsError } = useContrats()
  const { data: echeances = [], isLoading: echeancesLoading, error: echeancesError } = useEcheances()
  const { data: paiements = [], isLoading: paiementsLoading, error: paiementsError } = usePaiements()
  const { data: relances = [], error: relancesError } = useRelances()
  const generate = useGenererEcheances()
  const generateAll = useGenererEcheancesActives()
  const createEcheance = useCreateEcheance()
  const saveRelance = useCreateRelance()
  const setContractStatus = useSetContratStatus()
  const cancelDue = useCancelEcheance()
  const cancelPayment = useAnnulerPaiement()
  const paymentMutation = useEnregistrerPaiement()
  const [contractModal, setContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<RecouvrementContrat>()
  const [manualDueModal, setManualDueModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState(() => searchParams.get('encaisser') === '1')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [contractStatusFilter, setContractStatusFilter] = useState('')
  const [contractPeriodFilter, setContractPeriodFilter] = useState('')
  const [contractClientFilter, setContractClientFilter] = useState('')
  const [dueStatusFilter, setDueStatusFilter] = useState('')
  const [dueClientFilter, setDueClientFilter] = useState('')
  const [dueContractFilter, setDueContractFilter] = useState('')
  const [dueStart, setDueStart] = useState('')
  const [dueEnd, setDueEnd] = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [paymentCancelledFilter, setPaymentCancelledFilter] = useState('')
  const [paymentPeriodStart, setPaymentPeriodStart] = useState('')
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState('')
  const [periodEnd, setPeriodEnd] = useState(endOfCurrentMonth())
  const [selectedClient, setSelectedClient] = useState(clientId ?? searchParams.get('client') ?? '')
  const [selectedDueIds, setSelectedDueIds] = useState<string[]>([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today())
  const [allocationStrategy, setAllocationStrategy] = useState<'auto' | 'manual'>('auto')
  const [manualAllocations, setManualAllocations] = useState<Record<string, string>>({})
  const [paymentMode, setPaymentMode] = useState<PaymentInput['mode']>('virement')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentBank, setPaymentBank] = useState('')
  const [chequeEncashDate, setChequeEncashDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [relanceModal, setRelanceModal] = useState(() => Boolean(searchParams.get('relancer')))
  const [relanceClientId, setRelanceClientId] = useState(searchParams.get('relancer') ?? '')
  const [relanceCanal, setRelanceCanal] = useState<'telephone' | 'whatsapp' | 'email' | 'courrier' | 'visite'>('telephone')
  const [relanceNote, setRelanceNote] = useState('')
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseAmount, setPromiseAmount] = useState('')
  const [reminderDays, setReminderDays] = useState(7)

  const activeSection = location.pathname.split('/')[2] ?? 'tableau'
  const todayDate = today()
  const openDues = echeances.filter((item) => item.statut === 'ouverte')
  const dueClients = new Set(openDues.filter((item) => statusFor(item) === 'en_retard').map((item) => item.clientId))
  const totalOutstanding = openDues.reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
  const totalLate = openDues.filter((item) => statusFor(item) === 'en_retard').reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
  const collectedMonth = paiements.filter((item) => !item.annule && item.date.slice(0, 7) === todayDate.slice(0, 7)).reduce((sum, item) => sum + item.montant, 0)
  const monthlyDueItems = echeances.filter((item) => item.dateEcheance.slice(0, 7) === todayDate.slice(0, 7) && item.statut !== 'annulee')
  const monthlyDue = monthlyDueItems.reduce((sum, item) => sum + item.montantTTC, 0)
  const monthlyDueIds = new Set(monthlyDueItems.map((item) => item.id))
  const collectedForMonthDues = paiements.filter((item) => !item.annule && item.date.slice(0, 7) === todayDate.slice(0, 7))
    .reduce((sum, item) => sum + item.affectations.filter((allocation) => monthlyDueIds.has(allocation.echeanceId))
      .reduce((allocated, allocation) => allocated + allocation.montant, 0), 0)
  const monthlyCollectionRate = monthlyDue ? Math.round(Math.min(monthlyDue, collectedForMonthDues) / monthlyDue * 100) : 0
  const recentPayments = [...paiements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  const dashboardAging = calculateAgedBalances(openDues, todayDate)
  const clientDues = openDues.filter((item) => item.clientId === (clientId ?? selectedClient))
  const selectedDues = clientDues.filter((item) => selectedDueIds.includes(item.id))
  const selectedBalance = selectedDues.reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
  const filteredDues = sortRows(echeances.filter((item) =>
    `${item.clientNomSnapshot} ${item.libelle} ${item.id}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  ).filter((item) =>
    (!dueStatusFilter || statusFor(item) === dueStatusFilter)
    && (!dueClientFilter || item.clientId === dueClientFilter)
    && (!dueContractFilter || item.contratId === dueContractFilter)
    && (!dueStart || item.dateEcheance >= dueStart)
    && (!dueEnd || item.dateEcheance <= dueEnd),
  ), (a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
  const filteredContracts = sortRows(contrats.filter((item) =>
    `${item.numero} ${item.client.nom}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  ).filter((item) => (!contractStatusFilter || item.statut === contractStatusFilter)
    && (!contractPeriodFilter || item.periodicite === contractPeriodFilter)
    && (!contractClientFilter || item.clientId === contractClientFilter),
  ), (a, b) => b.dateDebut.localeCompare(a.dateDebut))
  const filteredPayments = sortRows(paiements.filter((item) =>
    `${item.numero} ${item.client.nom} ${item.reference}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')),
  ).filter((item) => (!paymentPeriodStart || item.date >= paymentPeriodStart) && (!paymentPeriodEnd || item.date <= paymentPeriodEnd))
    .filter((item) => (!paymentModeFilter || item.mode === paymentModeFilter)
      && (paymentCancelledFilter === '' || String(item.annule) === paymentCancelledFilter)),
  (a, b) => b.date.localeCompare(a.date))
  const pageSize = 15
  const displayedContracts = filteredContracts.slice((page - 1) * pageSize, page * pageSize)
  const displayedDues = filteredDues.slice((page - 1) * pageSize, page * pageSize)
  const displayedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize)
  const currentPageCount = Math.max(1, Math.ceil(
    (activeSection === 'contrats' ? filteredContracts.length : activeSection === 'echeances' ? filteredDues.length : filteredPayments.length) / pageSize,
  ))
  const specificContract = contrats.find((item) => item.id === contratId)
  const specificClient = clients.find((item) => item.id === clientId)
  const clientPayments = paiements.filter((item) => item.clientId === clientId && !item.annule).sort((a, b) => b.date.localeCompare(a.date))
  const clientReminders = relances.filter((item) => item.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date))
  const reminderCutoff = new Date(Date.parse(`${todayDate}T00:00:00.000Z`) - reminderDays * 86400000).toISOString().slice(0, 10)
  const delayedClients = [...dueClients].map((id) => {
    const latest = relances.filter((item) => item.clientId === id).sort((a, b) => b.date.localeCompare(a.date))[0]
    return { id, latest, overdue: openDues.filter((item) => item.clientId === id && statusFor(item) === 'en_retard') }
  }).filter((item) => !item.latest || item.latest.date.slice(0, 10) < reminderCutoff)
  const topDebtors = [...dueClients].map((id) => ({
    id,
    client: clients.find((item) => item.id === id)?.raisonSociale ?? openDues.find((item) => item.clientId === id)?.clientNomSnapshot ?? '',
    balance: openDues.filter((item) => item.clientId === id).reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0),
  })).sort((a, b) => b.balance - a.balance).slice(0, 10)

  function openPaymentFor(id?: string) {
    const target = id ?? clientId ?? ''
    if (clientId) {
      navigate(`/recouvrement/paiements?client=${encodeURIComponent(target)}&encaisser=1`)
      return
    }
    setSelectedClient(target)
    setSelectedDueIds([])
    setPaymentAmount('')
    setPaymentModal(true)
    if (!target) navigate('/recouvrement/paiements')
  }

  function openExistingReceipt(payment: Paiement) {
    const balance = openDues.filter((item) => item.clientId === payment.clientId)
      .reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
    navigate('/documents/editor', {
      state: { document: createPaymentReceipt(payment, settings, balance) },
    })
  }

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const client = clients.find((item) => item.id === selectedClient)
    const amount = Math.round((Number(paymentAmount.replace(',', '.')) || 0) * 100)
    if (!client || amount <= 0 || !selectedDues.length) {
      toast.error('Choisissez le client, les échéances et un montant valide.')
      return
    }
    let allocations: Array<{ echeanceId: string; libelle: string; montant: number }>
    try {
      const distribution = allocationStrategy === 'auto'
        ? allocatePaymentAutomatically(selectedDues, amount)
        : allocatePaymentManually(selectedDues, selectedDues
          .filter((item) => Number(manualAllocations[item.id]) > 0)
          .map((item) => ({ echeanceId: item.id, montantCents: Math.round(Number(manualAllocations[item.id]) * 100) })))
      if (distribution.montantAlloueCents !== amount) {
        throw new Error('Le montant reçu doit correspondre exactement à la somme des affectations.')
      }
      allocations = distribution.allocations.map((item) => {
        const due = selectedDues.find((entry) => entry.id === item.echeanceId)
        if (!due) throw new Error('Une échéance sélectionnée est introuvable.')
        return { echeanceId: item.echeanceId, libelle: due.libelle, montant: item.montantCents }
      })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Le montant dépasse le solde sélectionné.')
      return
    }
    if (!window.confirm(`Confirmer l’encaissement de ${formatMoney(amount / 100)} pour ${client.raisonSociale} ?`)) return
    try {
      const payment = await paymentMutation.mutateAsync({
        date: paymentDate,
        clientId: client.id,
        client: { nom: client.raisonSociale, adresse: client.adresse, ville: client.ville, ice: client.ice, telephone: client.telephones[0] ?? '', email: client.email },
        montant: amount,
        mode: paymentMode,
        reference: paymentReference,
        banque: paymentBank,
        ...(paymentMode === 'cheque' && chequeEncashDate ? { dateEncaissementCheque: chequeEncashDate } : {}),
        affectations: allocations,
        note: paymentNote,
      })
      toast.success(`Paiement ${payment.numero} enregistré.`)
      setPaymentModal(false)
      const currentBalance = openDues.filter((item) => item.clientId === client.id)
        .reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
      if (window.confirm('Paiement enregistré. Générer son reçu maintenant ?')) {
        navigate('/documents/editor', {
          state: {
            document: createPaymentReceipt(payment, settings, Math.max(0, currentBalance - payment.montant)),
          },
        })
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer le paiement.')
    }
  }

  async function generateForContract(contrat: RecouvrementContrat) {
    try {
      const result = await generate.mutateAsync({ contrat, jusquAu: periodEnd })
      toast.success(`${result.created} échéance(s) créée(s), ${result.ignored} déjà présente(s).`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'La génération de l’échéancier a échoué.')
    }
  }

  async function generateClientStatement() {
    if (!specificClient || !clientId) return
    try {
      const number = await getNextNumber('releve')
      const dues = echeances.filter((item) => item.clientId === clientId)
      const statement = createClientRecoveryStatement(
        settings,
        {
          nom: specificClient.raisonSociale,
          adresse: specificClient.adresse,
          ville: specificClient.ville,
          ice: specificClient.ice,
          telephone: specificClient.telephones[0] ?? '',
          email: specificClient.email,
        },
        dues,
        paiements.filter((item) => item.clientId === clientId),
        relances.filter((item) => item.clientId === clientId),
        calculateAgedBalances(dues.filter((item) => item.statut === 'ouverte'), todayDate),
        number,
      )
      navigate('/documents/editor', { state: { document: statement } })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de générer le relevé client.')
    }
  }

  async function createReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const client = clients.find((item) => item.id === relanceClientId)
    const dues = openDues.filter((item) => item.clientId === relanceClientId && statusFor(item) === 'en_retard')
    if (!client || !dues.length) {
      toast.error('Aucune échéance en retard à relancer pour ce client.')
      return
    }
    const previousLevel = relances
      .filter((item) => item.clientId === relanceClientId)
      .reduce((highest, item) => Math.max(highest, item.niveau), 0)
    const level = Math.min(3, previousLevel + 1) as 1 | 2 | 3
    const reminder = {
      clientId: client.id,
      client: { nom: client.raisonSociale, adresse: client.adresse, ville: client.ville, ice: client.ice, telephone: client.telephones[0] ?? '', email: client.email },
      echeancesIds: dues.map((item) => item.id),
      niveau: level,
      canal: relanceCanal,
      date: today(),
      note: relanceNote,
      ...(promiseDate ? { promesseDate: promiseDate } : {}),
      ...(promiseAmount ? { promesseMontant: Math.round(Number(promiseAmount) * 100) } : {}),
      resultat: 'sans_reponse' as const,
    }
    try {
      await saveRelance.mutateAsync(reminder)
      toast.success(`Relance de niveau ${level} enregistrée.`)
      setRelanceModal(false)
      if (window.confirm('Générer une lettre de relance modifiable ?')) {
        const number = await getNextNumber('relance')
        navigate('/documents/editor', {
          state: {
            document: createReminderLetter(
              settings,
              reminder.client,
              dues,
              level,
              number,
            ),
          },
        })
      } else {
        const phone = client.telephones[0]?.replace(/\D/g, '').replace(/^0/, '212')
        if (relanceCanal === 'whatsapp' && phone) {
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${client.raisonSociale}, nous vous contactons concernant vos échéances en attente.`)}`, '_blank', 'noopener,noreferrer')
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’enregistrer la relance.')
    }
  }

  async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
    try {
      const bytes = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([bytes]), filename)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? `L’export Excel a échoué : ${error.message}` : 'L’export Excel a échoué.')
    }
  }

  async function exportDues() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Échéances')
    sheet.columns = [
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Libellé', key: 'label', width: 32 },
      { header: 'Échéance', key: 'date', width: 16 },
      { header: 'Montant TTC (MAD)', key: 'amount', width: 20 },
      { header: 'Payé (MAD)', key: 'paid', width: 16 },
      { header: 'Reste dû (MAD)', key: 'remaining', width: 18 },
      { header: 'Statut', key: 'status', width: 22 },
    ]
    for (const due of filteredDues) sheet.addRow({
      client: due.clientNomSnapshot,
      label: due.libelle,
      date: due.dateEcheance,
      amount: due.montantTTC / 100,
      paid: due.montantPaye / 100,
      remaining: (due.montantTTC - due.montantPaye) / 100,
      status: statusLabels[statusFor(due)],
    })
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
    sheet.getColumn('amount').numFmt = '#,##0.00 "MAD"'
    sheet.getColumn('paid').numFmt = '#,##0.00 "MAD"'
    sheet.getColumn('remaining').numFmt = '#,##0.00 "MAD"'
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } }
    await downloadWorkbook(workbook, `echeances-${today()}.xlsx`)
  }

  async function exportPayments() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Encaissements')
    sheet.columns = [
      { header: 'Reçu', key: 'number', width: 20 },
      { header: 'Date', key: 'date', width: 16 },
      { header: 'Client', key: 'client', width: 28 },
      { header: 'Mode', key: 'mode', width: 16 },
      { header: 'Référence', key: 'reference', width: 20 },
      { header: 'Montant (MAD)', key: 'amount', width: 18 },
      { header: 'Annulé', key: 'cancelled', width: 12 },
    ]
    for (const payment of filteredPayments) sheet.addRow({
      number: payment.numero,
      date: payment.date,
      client: payment.client.nom,
      mode: payment.mode,
      reference: payment.reference,
      amount: payment.annule ? 0 : payment.montant / 100,
      cancelled: payment.annule ? 'Oui' : 'Non',
    })
    sheet.addRow([])
    sheet.addRow(['Totaux par mode'])
    for (const mode of ['especes', 'cheque', 'virement', 'carte', 'effet'] as const) {
      sheet.addRow([mode, filteredPayments.filter((item) => !item.annule && item.mode === mode).reduce((sum, item) => sum + item.montant, 0) / 100])
    }
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
    sheet.getColumn('amount').numFmt = '#,##0.00 "MAD"'
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: filteredPayments.length + 1, column: 7 } }
    await downloadWorkbook(workbook, `encaissements-${paymentPeriodStart || 'debut'}-${paymentPeriodEnd || today()}.xlsx`)
  }

  async function exportAging() {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Balance âgée')
    sheet.columns = [
      { header: 'Client', key: 'client', width: 30 },
      { header: '0–30 jours (MAD)', key: 'd30', width: 20 },
      { header: '31–60 jours (MAD)', key: 'd60', width: 22 },
      { header: '61–90 jours (MAD)', key: 'd90', width: 22 },
      { header: 'Plus de 90 jours (MAD)', key: 'd90plus', width: 26 },
      { header: 'Total (MAD)', key: 'total', width: 18 },
    ]
    for (const id of dueClients) {
      const clientDues = openDues.filter((item) => item.clientId === id)
      const aged = calculateAgedBalances(clientDues, todayDate)
      sheet.addRow({
        client: clientDues[0]?.clientNomSnapshot ?? '',
        d30: aged.jours0a30Cents / 100,
        d60: aged.jours31a60Cents / 100,
        d90: aged.jours61a90Cents / 100,
        d90plus: aged.plus90JoursCents / 100,
        total: aged.totalCents / 100,
      })
    }
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
    for (const column of ['d30', 'd60', 'd90', 'd90plus', 'total']) {
      sheet.getColumn(column).numFmt = '#,##0.00 "MAD"'
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: 6 } }
    await downloadWorkbook(workbook, `balance-agee-${todayDate}.xlsx`)
  }

  if ((clientsLoading || contratsLoading || echeancesLoading || paiementsLoading) && !contrats.length && !echeances.length) {
    return <Card className="p-8"><Spinner label="Chargement du recouvrement" /></Card>
  }

  if (clientId && specificClient) {
    const dues = echeances.filter((item) => item.clientId === clientId)
    const balance = dues.filter((item) => item.statut === 'ouverte').reduce((sum, item) => sum + item.montantTTC - item.montantPaye, 0)
    const aging = calculateAgedBalances(dues.filter((item) => item.statut === 'ouverte'), todayDate)
    return (
      <>
        <PageHeader title={`Situation client · ${specificClient.raisonSociale}`} description={`${specificClient.code} · Solde dû : ${formatMoney(balance / 100)}`} action={<div className="flex flex-wrap gap-2"><Button onClick={() => openPaymentFor(clientId)}><Banknote size={16} /> Encaisser</Button><Button variant="outline" onClick={() => navigate(`/recouvrement?relancer=${encodeURIComponent(clientId)}`)}><BellRing size={16} /> Relancer</Button><Button variant="outline" onClick={() => void generateClientStatement()}><ReceiptText size={16} /> Fiche de recouvrement</Button></div>} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5"><h2 className="font-semibold">Échéances</h2><div className="mt-3 divide-y divide-slate-100">{dues.length ? dues.map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.libelle}<small className="block text-slate-500">{formatDate(item.dateEcheance)}</small></span><span className="text-right">{formatMoney((item.montantTTC - item.montantPaye) / 100)}<Badge className="ml-2" variant={statusVariant[statusFor(item)]}>{statusLabels[statusFor(item)]}</Badge></span></div>) : <p className="py-5 text-sm text-slate-500">Aucune échéance.</p>}</div></Card>
          <Card className="p-5"><h2 className="font-semibold">Balance âgée</h2><div className="mt-3 space-y-2 text-sm">{[['0–30 jours', aging.jours0a30Cents], ['31–60 jours', aging.jours31a60Cents], ['61–90 jours', aging.jours61a90Cents], ['Plus de 90 jours', aging.plus90JoursCents]].map(([label, amount]) => <div key={String(label)} className="flex justify-between"><span>{label}</span><strong>{formatMoney(Number(amount) / 100)}</strong></div>)}</div></Card>
          <Card className="p-5"><h2 className="font-semibold">Historique des paiements</h2><div className="mt-3 divide-y divide-slate-100">{clientPayments.length ? clientPayments.map((item) => <div key={item.id} className="flex justify-between py-3 text-sm"><span>{item.numero} · {formatDate(item.date)}<small className="block text-slate-500">{item.mode}</small></span><strong>{formatMoney(item.montant / 100)}</strong></div>) : <p className="py-5 text-sm text-slate-500">Aucun paiement.</p>}</div></Card>
          <Card className="p-5"><h2 className="font-semibold">Historique des relances</h2><div className="mt-3 divide-y divide-slate-100">{clientReminders.length ? clientReminders.map((item) => <div key={item.id} className="py-3 text-sm">Niveau {item.niveau} · {item.canal} · {formatDate(item.date)}<p className="text-slate-500">{item.resultat}</p></div>) : <p className="py-5 text-sm text-slate-500">Aucune relance enregistrée.</p>}</div></Card>
        </div>
      </>
    )
  }

  if (contratId && specificContract) {
    const contractDues = echeances.filter((item) => item.contratId === contratId).sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance))
    const contractExpired = Boolean(specificContract.dateFin && specificContract.dateFin < todayDate && specificContract.statut === 'actif')
    return (
      <>
        <PageHeader title={`Contrat ${specificContract.numero}`} description={`${specificContract.client.nom} · ${periodLabels[specificContract.periodicite]}`} action={<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!canEdit} onClick={() => { setEditingContract(specificContract); setContractModal(true) }}>Modifier</Button><Button variant="outline" onClick={() => navigate('/documents/editor', { state: { document: createContractScheduleDocument(settings, specificContract, contractDues) } })}><ReceiptText size={15} /> Document échéancier</Button><Button onClick={() => void generateForContract(specificContract)} loading={generate.isPending}><RefreshCw size={15} /> Générer l’échéancier</Button>{contractExpired && canEdit && <Button variant="outline" onClick={() => void setContractStatus.mutateAsync({ contrat: specificContract, statut: 'termine' }).then(() => toast.success('Contrat terminé et appareils mis à jour.')).catch(() => toast.error('Impossible de terminer le contrat.'))}>Clore le contrat expiré</Button>}</div>} />
        <Card className="mb-4 grid gap-3 p-5 text-sm sm:grid-cols-3">
          <div>Prestation : <strong>{specificContract.typePrestation}</strong></div><div>Montant par période : <strong>{formatMoney(specificContract.montantPeriodeTTC / 100)}</strong></div><div>Statut : <Badge>{specificContract.statut}</Badge></div><div>Du {formatDate(specificContract.dateDebut)}{specificContract.dateFin && ` au ${formatDate(specificContract.dateFin)}`}</div><div>Appareils : {specificContract.ascenseursCodes.join(', ') || '—'}</div>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={!canEdit || setContractStatus.isPending} onClick={() => void setContractStatus.mutateAsync({ contrat: specificContract, statut: specificContract.statut === 'actif' ? 'suspendu' : 'actif' }).then(() => toast.success('Statut du contrat modifié.')).catch(() => toast.error('Impossible de modifier le contrat.'))}>{specificContract.statut === 'actif' ? 'Suspendre' : 'Reprendre'}</Button><Button size="sm" variant="danger" disabled={!canEdit || setContractStatus.isPending} onClick={() => { const motif = window.prompt('Motif de résiliation'); if (motif?.trim() && window.confirm('Confirmer la résiliation du contrat ?')) void setContractStatus.mutateAsync({ contrat: specificContract, statut: 'resilie', motif }).then(() => toast.success('Contrat résilié.')).catch(() => toast.error('Impossible de résilier le contrat.')) }}>Résilier</Button></div>
        </Card>
        <Card className="p-5"><h2 className="font-semibold">Échéancier</h2><div className="mt-3 divide-y divide-slate-100">{contractDues.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{item.libelle} · {formatDate(item.dateEcheance)}</span><span>{formatMoney(item.montantTTC / 100)} · <Badge variant={statusVariant[statusFor(item)]}>{statusLabels[statusFor(item)]}</Badge></span></div>)}{contractDues.length === 0 && <p className="py-5 text-sm text-slate-500">Aucune échéance générée.</p>}</div></Card>
        <Modal open={contractModal} onClose={() => setContractModal(false)} title="Modifier le contrat" className="w-[min(100%-2rem,58rem)]"><ContractEditor existing={editingContract} onClose={() => setContractModal(false)} /></Modal>
      </>
    )
  }

  const pageTitle = activeSection === 'contrats' ? 'Contrats de maintenance'
    : activeSection === 'echeances' ? 'Échéances'
      : activeSection === 'paiements' ? 'Paiements et encaissements'
        : 'Recouvrement'
  return (
    <>
      <PageHeader title={pageTitle} description={activeSection === 'tableau' ? 'Suivez les montants à encaisser, les retards et les relances.' : 'Suivi des contrats et des encaissements clients.'} action={<div className="flex flex-wrap gap-2">{activeSection === 'contrats' && canCreate && <Button onClick={() => { setEditingContract(undefined); setContractModal(true) }}><Plus size={16} /> Nouveau contrat</Button>}{activeSection === 'contrats' && canCreate && <Button variant="outline" onClick={() => void generateAll.mutateAsync(periodEnd).then((result) => toast.success(`${result.created} créée(s), ${result.ignored} ignorée(s).`)).catch(() => toast.error('La génération des échéances a échoué.'))} loading={generateAll.isPending}>Générer les échéances du mois</Button>}{activeSection === 'echeances' && <Button variant="outline" onClick={() => void exportDues()}><FileSpreadsheet size={16} /> Export Excel</Button>}{activeSection === 'echeances' && canCreate && <Button onClick={() => setManualDueModal(true)}><Plus size={16} /> Échéance manuelle</Button>}{activeSection === 'paiements' && canCreate && <Button onClick={() => openPaymentFor()}><Banknote size={16} /> Encaisser</Button>}</div>} />
      {clientsError || contratsError || echeancesError || paiementsError || relancesError
        ? <Card className="mb-4 p-4 text-sm text-danger-700">Une partie des données de recouvrement n’a pas pu être chargée. Actualisez la page ou vérifiez vos droits d’accès.</Card>
        : null}
      {activeSection === 'tableau' && (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[['Total à encaisser', totalOutstanding], ['Total en retard', totalLate], ['Encaissé ce mois', collectedMonth], ['Taux du mois', monthlyCollectionRate], ['Clients en retard', dueClients.size]].map(([label, amount]) => <Card key={String(label)} className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-navy-900">{label === 'Taux du mois' ? `${amount}%` : label === 'Clients en retard' ? amount : formatMoney(Number(amount) / 100)}</p></Card>)}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
              <Card className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Balance âgée</h2><Button size="sm" variant="outline" onClick={() => void exportAging()}><FileSpreadsheet size={14} /> Export Excel</Button></div><div className="mt-4 space-y-3">{([['0–30', dashboardAging.jours0a30Cents], ['31–60', dashboardAging.jours31a60Cents], ['61–90', dashboardAging.jours61a90Cents], ['90+', dashboardAging.plus90JoursCents]] as Array<[string, number]>).map(([label, amount]) => <div key={label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm"><span>{label} jours</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gold-500" style={{ width: `${totalLate ? Math.min(100, amount / totalLate * 100) : 0}%` }} /></div><strong>{formatMoney(amount / 100)}</strong></div>)}</div></Card>
            <Card className="p-5"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">À relancer aujourd’hui</h2><label className="flex items-center gap-2 text-xs text-slate-500">Sans relance depuis<Input className="w-16" aria-label="Délai de relance en jours" type="number" min="1" max="90" value={reminderDays} onChange={(event) => setReminderDays(Math.max(1, Number(event.currentTarget.value) || 7))} />jours</label></div><div className="mt-3 divide-y divide-slate-100">{delayedClients.slice(0, 10).map((item) => { const client = clients.find((entry) => entry.id === item.id); return <div key={item.id} className="flex items-center justify-between gap-2 py-3 text-sm"><Link to={`/recouvrement/clients/${item.id}`} className="font-medium text-navy-900">{client?.raisonSociale ?? item.overdue[0]?.clientNomSnapshot}</Link><Button size="sm" variant="outline" onClick={() => { setRelanceClientId(item.id); setRelanceModal(true) }}><BellRing size={14} /> Relancer</Button></div> })}{!delayedClients.length && <p className="py-4 text-sm text-slate-500">Aucun client à relancer.</p>}</div></Card>
            <Card className="p-5"><h2 className="font-semibold">Top 10 des débiteurs</h2><div className="mt-3 divide-y divide-slate-100">{topDebtors.map((item) => <Link key={item.id} to={`/recouvrement/clients/${item.id}`} className="flex justify-between gap-3 py-3 text-sm"><span>{item.client}</span><strong>{formatMoney(item.balance / 100)}</strong></Link>)}{!topDebtors.length && <p className="py-4 text-sm text-slate-500">Aucun solde en retard.</p>}</div></Card>
            <Card className="p-5 xl:col-span-2"><h2 className="font-semibold">Encaissements récents</h2><div className="mt-3 divide-y divide-slate-100">{recentPayments.length ? recentPayments.map((item) => <div key={item.id} className="flex justify-between gap-3 py-3 text-sm"><span>{item.numero} · {item.client.nom}<small className="block text-slate-500">{formatDate(item.date)} · {item.mode}{item.annule ? ' · Annulé' : ''}</small></span><strong>{formatMoney(item.montant / 100)}</strong></div>) : <p className="py-4 text-sm text-slate-500">Aucun encaissement récent.</p>}</div></Card>
          </div>
        </>
      )}
      {activeSection === 'contrats' && <><div className="mb-3 flex flex-wrap gap-2"><Search size={18} className="mt-2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }} placeholder="Rechercher un contrat ou un client…" /><Select aria-label="Filtrer par statut" value={contractStatusFilter} onChange={(event) => { setContractStatusFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les statuts</option><option value="actif">Actif</option><option value="suspendu">Suspendu</option><option value="resilie">Résilié</option><option value="termine">Terminé</option></Select><Select aria-label="Filtrer par périodicité" value={contractPeriodFilter} onChange={(event) => { setContractPeriodFilter(event.currentTarget.value); setPage(1) }}><option value="">Toutes les périodes</option>{periods.map((item) => <option key={item} value={item}>{periodLabels[item]}</option>)}</Select><Select aria-label="Filtrer par client" value={contractClientFilter} onChange={(event) => { setContractClientFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les clients</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.raisonSociale}</option>)}</Select><Input type="date" aria-label="Générer jusqu’au" value={periodEnd} onChange={(event) => setPeriodEnd(event.currentTarget.value)} /></div><Card className="divide-y divide-slate-100 p-4">{displayedContracts.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><Link to={`/recouvrement/contrats/${item.id}`} className="font-semibold text-navy-900">{item.numero} · {item.client.nom}<small className="block font-normal text-slate-500">{periodLabels[item.periodicite]} · {formatMoney(item.montantPeriodeTTC / 100)} · {item.ascenseursCodes.join(', ') || 'Sans appareil'}</small></Link><div className="flex gap-2"><Badge>{item.statut}</Badge><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => { setEditingContract(item); setContractModal(true) }}>Modifier</Button><Button size="sm" variant="ghost" disabled={!canCreate} onClick={() => void generateForContract(item)} aria-label="Générer l’échéancier"><RefreshCw size={15} /></Button></div></div>)}{!filteredContracts.length && <p className="py-5 text-center text-sm text-slate-500">Aucun contrat.</p>}</Card></>}
      {activeSection === 'echeances' && <><div className="mb-3 flex flex-wrap gap-2"><Search size={18} className="mt-2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }} placeholder="Rechercher un client ou une échéance…" /><Select aria-label="Filtrer par statut" value={dueStatusFilter} onChange={(event) => { setDueStatusFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les statuts</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select><Select aria-label="Filtrer par client" value={dueClientFilter} onChange={(event) => { setDueClientFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les clients</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.raisonSociale}</option>)}</Select><Select aria-label="Filtrer par contrat" value={dueContractFilter} onChange={(event) => { setDueContractFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les contrats</option>{contrats.map((item) => <option key={item.id} value={item.id}>{item.numero}</option>)}</Select><Input type="date" aria-label="Période à partir du" value={dueStart} onChange={(event) => { setDueStart(event.currentTarget.value); setPage(1) }} /><Input type="date" aria-label="Période jusqu’au" value={dueEnd} onChange={(event) => { setDueEnd(event.currentTarget.value); setPage(1) }} /></div><Card className="divide-y divide-slate-100 p-4">{displayedDues.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm"><Link to={`/recouvrement/clients/${item.clientId}`} className="font-semibold text-navy-900">{item.clientNomSnapshot}</Link><small className="block text-slate-500">{item.libelle} · Échéance {formatDate(item.dateEcheance)}</small></span><span className="flex items-center gap-2 text-sm"><span>{formatMoney((item.montantTTC - item.montantPaye) / 100)} dû</span><Badge variant={statusVariant[statusFor(item)]}>{statusLabels[statusFor(item)]}</Badge>{canCreate && item.statut === 'ouverte' && <Button size="sm" variant="outline" onClick={() => openPaymentFor(item.clientId)}><Banknote size={14} /></Button>}{isDirector && item.statut === 'ouverte' && item.montantPaye === 0 && <Button size="sm" variant="ghost" aria-label="Annuler l’échéance" onClick={() => { const reason = window.prompt('Motif d’annulation'); if (reason?.trim() && window.confirm('Confirmer l’annulation de cette échéance ?')) void cancelDue.mutateAsync({ echeance: item, motif: reason }).then(() => toast.success('Échéance annulée.')).catch(() => toast.error('Impossible d’annuler l’échéance.')) }}><XCircle size={15} /></Button>}</span></div>)}{!filteredDues.length && <p className="py-5 text-center text-sm text-slate-500">Aucune échéance.</p>}</Card></>}
      {activeSection === 'paiements' && <><div className="mb-3 flex flex-wrap gap-2"><Search size={18} className="mt-2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.currentTarget.value); setPage(1) }} placeholder="Rechercher un reçu, client ou référence…" /><Select aria-label="Filtrer par mode" value={paymentModeFilter} onChange={(event) => { setPaymentModeFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les modes</option><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="carte">Carte</option><option value="effet">Effet</option></Select><Select aria-label="Filtrer les paiements annulés" value={paymentCancelledFilter} onChange={(event) => { setPaymentCancelledFilter(event.currentTarget.value); setPage(1) }}><option value="">Tous les paiements</option><option value="false">Non annulés</option><option value="true">Annulés</option></Select><Input type="date" aria-label="Date de début" value={paymentPeriodStart} onChange={(event) => { setPaymentPeriodStart(event.currentTarget.value); setPage(1) }} /><Input type="date" aria-label="Date de fin" value={paymentPeriodEnd} onChange={(event) => { setPaymentPeriodEnd(event.currentTarget.value); setPage(1) }} /><Button variant="outline" onClick={() => void exportPayments()}><FileSpreadsheet size={16} /> Export Excel</Button></div><Card className="divide-y divide-slate-100 p-4">{displayedPayments.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm"><strong className="text-navy-900">{item.numero} · {item.client.nom}</strong><small className="block text-slate-500">{formatDate(item.date)} · {item.mode}{item.reference ? ` · ${item.reference}` : ''}{item.annule ? ` · Annulé : ${item.motifAnnulation}` : ''}</small></span><span className="flex items-center gap-2"><strong>{formatMoney(item.montant / 100)}</strong><Button size="sm" variant="outline" onClick={() => openExistingReceipt(item)}><ReceiptText size={14} /> Reçu</Button>{isDirector && !item.annule && <Button size="sm" variant="danger" onClick={() => { const reason = window.prompt('Motif obligatoire de l’annulation du paiement'); if (reason?.trim() && window.confirm(`Annuler le paiement ${item.numero} et restituer ses affectations ?`)) void cancelPayment.mutateAsync({ paiement: item, motif: reason }).then(() => toast.success('Paiement annulé et échéances rouvertes.')).catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Annulation impossible.')) }}>Annuler</Button>}</span></div>)}{!filteredPayments.length && <p className="py-5 text-center text-sm text-slate-500">Aucun paiement enregistré.</p>}</Card></>}
      {['contrats', 'echeances', 'paiements'].includes(activeSection) && <div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>Page {page} sur {currentPageCount}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Précédent</Button><Button size="sm" variant="outline" disabled={page >= currentPageCount} onClick={() => setPage((value) => value + 1)}>Suivant</Button></div></div>}
      {contractModal && <Modal open={contractModal} onClose={() => setContractModal(false)} title={editingContract ? 'Modifier le contrat' : 'Nouveau contrat'} className="w-[min(100%-2rem,58rem)]"><ContractEditor existing={editingContract} onClose={() => setContractModal(false)} /></Modal>}
      {manualDueModal && <ManualDueModal clients={clients} onClose={() => setManualDueModal(false)} onSave={async (input) => { await createEcheance.mutateAsync(input); setManualDueModal(false); toast.success('Échéance créée.') }} />}
      {paymentModal && <Modal open onClose={() => setPaymentModal(false)} title="Encaisser un paiement" className="w-[min(100%-2rem,42rem)]"><form onSubmit={(event) => void submitPayment(event)} className="space-y-4">
        <ClientPicker value={selectedClient} onChange={(value) => { setSelectedClient(value); setSelectedDueIds([]); setManualAllocations({}); setPaymentAmount('') }} />
        <div className="flex gap-2"><Button type="button" size="sm" variant={allocationStrategy === 'auto' ? 'primary' : 'outline'} onClick={() => setAllocationStrategy('auto')}>Plus anciennes d’abord</Button><Button type="button" size="sm" variant={allocationStrategy === 'manual' ? 'primary' : 'outline'} onClick={() => setAllocationStrategy('manual')}>Affectation manuelle</Button></div>
        <div className="max-h-52 divide-y overflow-y-auto rounded-lg border border-slate-200">{clientDues.map((item) => <label key={item.id} className="flex items-center justify-between gap-2 p-3 text-sm"><span><input type="checkbox" className="mr-2" checked={selectedDueIds.includes(item.id)} onChange={(event) => setSelectedDueIds((ids) => event.currentTarget.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />{item.libelle}<small className="block text-slate-500">{formatDate(item.dateEcheance)}</small></span><span className="flex items-center gap-2"><strong>{formatMoney((item.montantTTC - item.montantPaye) / 100)}</strong>{allocationStrategy === 'manual' && selectedDueIds.includes(item.id) && <Input aria-label={`Montant affecté à ${item.libelle} en MAD`} className="w-28" type="number" min="0" max={(item.montantTTC - item.montantPaye) / 100} step="0.01" value={manualAllocations[item.id] ?? ''} onChange={(event) => setManualAllocations((values) => ({ ...values, [item.id]: event.currentTarget.value }))} />}</span></label>)}{selectedClient && !clientDues.length && <p className="p-4 text-sm text-slate-500">Aucune échéance ouverte pour ce client.</p>}</div>
        <div className="flex items-end gap-2"><label className="flex-1 space-y-1 text-sm">Montant reçu (MAD)<Input required type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.currentTarget.value)} /></label><Button type="button" variant="outline" onClick={() => { setPaymentAmount((selectedBalance / 100).toFixed(2)); if (allocationStrategy === 'manual') setManualAllocations(Object.fromEntries(selectedDues.map((item) => [item.id, ((item.montantTTC - item.montantPaye) / 100).toFixed(2)]))) }}>Solder la sélection</Button></div>
        <p className="text-xs text-slate-500">Montant sélectionné maximal : {formatMoney(selectedBalance / 100)}. Répartition automatique par échéance la plus ancienne.</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Date de paiement<Input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.currentTarget.value)} /></label><label className="space-y-1 text-sm">Mode<Select value={paymentMode} onChange={(event) => setPaymentMode(event.currentTarget.value as PaymentInput['mode'])}><option value="especes">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option><option value="carte">Carte</option><option value="effet">Effet</option></Select></label><label className="space-y-1 text-sm">Référence<Input value={paymentReference} onChange={(event) => setPaymentReference(event.currentTarget.value)} /></label><label className="space-y-1 text-sm">Banque<Input value={paymentBank} onChange={(event) => setPaymentBank(event.currentTarget.value)} /></label>{paymentMode === 'cheque' && <label className="space-y-1 text-sm">Date d’encaissement prévue<Input type="date" value={chequeEncashDate} onChange={(event) => setChequeEncashDate(event.currentTarget.value)} /></label>}</div>
        <label className="block space-y-1 text-sm">Note<Textarea value={paymentNote} onChange={(event) => setPaymentNote(event.currentTarget.value)} /></label>
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setPaymentModal(false)}>Annuler</Button><Button type="submit" loading={paymentMutation.isPending}><ReceiptText size={15} /> Confirmer l’encaissement</Button></div>
      </form></Modal>}
      {relanceModal && <Modal open onClose={() => setRelanceModal(false)} title="Enregistrer une relance"><form className="space-y-4" onSubmit={(event) => void createReminder(event)}><Select aria-label="Client à relancer" value={relanceClientId} onChange={(event) => setRelanceClientId(event.currentTarget.value)}><option value="">Sélectionner un client</option>{clients.filter((item) => openDues.some((due) => due.clientId === item.id && statusFor(due) === 'en_retard')).map((item) => <option key={item.id} value={item.id}>{item.raisonSociale}</option>)}</Select><Select aria-label="Canal de relance" value={relanceCanal} onChange={(event) => setRelanceCanal(event.currentTarget.value as typeof relanceCanal)}><option value="telephone">Téléphone</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="courrier">Courrier</option><option value="visite">Visite</option></Select><Textarea aria-label="Note de relance" placeholder="Compte rendu de la relance" value={relanceNote} onChange={(event) => setRelanceNote(event.currentTarget.value)} /><div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm">Promesse de paiement<Input type="date" value={promiseDate} onChange={(event) => setPromiseDate(event.currentTarget.value)} /></label><label className="space-y-1 text-sm">Montant promis (MAD)<Input min="0" step="0.01" type="number" value={promiseAmount} onChange={(event) => setPromiseAmount(event.currentTarget.value)} /></label></div><p className="text-sm text-slate-500">Le niveau est proposé d’après le nombre de relances déjà enregistrées.</p><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRelanceModal(false)}>Annuler</Button><Button type="submit" loading={saveRelance.isPending}>Enregistrer la relance</Button></div></form></Modal>}
    </>
  )

}

function ManualDueModal({
  clients,
  onClose,
  onSave,
}: {
  clients: Client[]
  onClose: () => void
  onSave: (input: EcheanceInput) => Promise<void>
}) {
  const [clientId, setClientId] = useState('')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const client = clients.find((item) => item.id === clientId)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    const ttc = Math.round((Number(amount.replace(',', '.')) || 0) * 100)
    if (ttc <= 0) return
    setBusy(true)
    try {
      await onSave({
        clientId,
        clientNomSnapshot: client.raisonSociale,
        libelle: label,
        periodeDebut: date,
        periodeFin: date,
        dateEcheance: date,
        montantHT: ttc,
        montantTTC: ttc,
        tvaPct: 0,
        notes: '',
      })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de créer l’échéance.')
    } finally {
      setBusy(false)
    }
  }

  return <Modal open onClose={onClose} title="Créer une échéance manuelle"><form onSubmit={(event) => void submit(event)} className="space-y-4"><ClientPicker value={clientId} onChange={setClientId} /><label className="block space-y-1 text-sm">Libellé<Input required value={label} onChange={(event) => setLabel(event.currentTarget.value)} /></label><label className="block space-y-1 text-sm">Montant TTC (MAD)<Input required min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} /></label><label className="block space-y-1 text-sm">Date d’échéance<Input required type="date" value={date} onChange={(event) => setDate(event.currentTarget.value)} /></label><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" loading={busy}>Créer l’échéance</Button></div></form></Modal>
}
