import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  Plus,
  Users,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/features/auth/authStore'
import { hasPermission, type AppModule } from '@/lib/permissions'
import { displayNameOrEmail, roleLabel } from '@/lib/user'
import { useInterventions } from '@/features/interventions/useInterventions'
import { useDevis } from '@/features/devis/useDevis'
import { useEcheances } from '@/features/recouvrement/useRecouvrement'
import { deriveStatut } from '@/features/recouvrement/logic'

const quickActions: {
  label: string
  description: string
  to: string
  module: AppModule
  action: 'voir' | 'creer'
  icon: typeof Users
}[] = [
  {
    label: 'Ajouter un client',
    description: 'Créer une nouvelle fiche client',
    to: '/clients',
    module: 'clients',
    action: 'creer',
    icon: Users,
  },
  {
    label: 'Créer un devis',
    description: 'Préparer une nouvelle proposition',
    to: '/devis',
    module: 'devis',
    action: 'creer',
    icon: FilePlus2,
  },
  {
    label: 'Voir les interventions',
    description: 'Consulter les opérations terrain',
    to: '/interventions',
    module: 'interventions',
    action: 'voir',
    icon: Wrench,
  },
]

export function DashboardPage() {
  const profile = useAuth((state) => state.profile)
  const { data: interventions = [], isLoading: interventionsLoading } = useInterventions()
  const commercialAccess = profile?.role === 'directeur' || profile?.role === 'commercial'
  const { data: quotes = [], isLoading: quotesLoading } = useDevis(commercialAccess)
  const { data: dues = [], isLoading: duesLoading } = useEcheances(commercialAccess)
  const name = profile ? displayNameOrEmail(profile) : 'bienvenue'
  const civilite = profile?.civilite ?? 'M.'
  const todayKey = new Date().toISOString().slice(0, 10)
  const today = new Intl.DateTimeFormat('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  const availableActions = quickActions.filter(({ module, action }) =>
    hasPermission(profile?.role, module, action),
  )
  const activeInterventions = interventions.filter(
    (item) => !['terminee', 'cloturee', 'annulee'].includes(item.statut),
  )
  const statsLoading = interventionsLoading || (commercialAccess && (quotesLoading || duesLoading))
  const dashboardStats = [
    {
      label: 'Interventions prévues aujourd’hui',
      value: interventions.filter((item) => item.datePrevue === todayKey && !['annulee', 'cloturee'].includes(item.statut)).length,
      trend: 'Selon les interventions accessibles',
      icon: CalendarDays,
      tone: 'bg-navy-50 text-navy-700',
      to: '/interventions',
    },
    {
      label: 'Interventions urgentes ouvertes',
      value: activeInterventions.filter((item) => item.priorite === 'urgente').length,
      trend: 'À traiter en priorité',
      icon: AlertTriangle,
      tone: 'bg-danger-50 text-danger-700',
      to: '/interventions',
    },
    {
      label: 'Interventions en cours',
      value: activeInterventions.filter((item) => item.statut === 'en_cours').length,
      trend: 'Toutes périodes',
      icon: Wrench,
      tone: 'bg-success-50 text-success-700',
      to: '/interventions',
    },
    ...(commercialAccess ? [{
      label: 'Devis à relancer',
      value: quotes.filter((item) => item.status === 'sent' && item.validUntil <= todayKey).length,
      trend: 'Devis envoyés arrivés à échéance',
      icon: Clock3,
      tone: 'bg-warning-50 text-warning-700',
      to: '/devis',
    }] : []),
    ...(commercialAccess ? [{
      label: 'Échéances en retard',
      value: dues.filter((item) => deriveStatut(item, todayKey) === 'en_retard').length,
      trend: 'À suivre dans le recouvrement',
      icon: ClipboardCheck,
      tone: 'bg-danger-50 text-danger-700',
      to: '/recouvrement/echeances',
    }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Votre activité et vos priorités en un coup d’œil."
      />

      <Card className="welcome-panel relative mb-7 overflow-hidden border-navy-800 p-6 text-white shadow-[0_20px_55px_-24px_rgba(6,18,37,0.65)] sm:p-8 lg:p-9">
        <div className="welcome-lines pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-30" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 -top-32 size-80 rounded-full border border-gold-300/15" aria-hidden="true" />
        <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-white/10 bg-white/[0.08] text-gold-300 ring-white/10">
                Espace de pilotage
              </Badge>
              <span className="text-xs capitalize text-slate-400">{today}</span>
            </div>
            <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Bonjour {civilite} {name}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              {profile && <>{roleLabel(profile.role)} · </>}
              <span className="capitalize">{today}</span>
              <span className="mx-1.5">·</span>
              Retrouvez ici les repères essentiels de votre activité TGI Ascenseurs.
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
      </Card>

      <section aria-label="Indicateurs opérationnels" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardStats.map(({ label, value, trend, icon: Icon, tone, to }) => (
          <Link key={label} to={to} className="block min-w-0">
          <Card className="group relative h-full overflow-hidden border-slate-200/80 p-5 shadow-[0_4px_18px_rgba(11,31,58,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-3 font-heading text-3xl font-semibold tracking-tight text-navy-950">
                  {statsLoading ? '…' : value}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="size-1.5 rounded-full bg-gold-400" />
                  {trend}
                </p>
              </div>
              <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon size={18} aria-hidden="true" />
              </span>
            </div>
          </Card>
          </Link>
        ))}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-heading text-base font-semibold text-navy-950">Actions rapides</h2>
              <p className="mt-1 text-xs text-slate-500">Accédez directement à vos espaces de travail.</p>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Selon vos accès
            </span>
          </div>
          <div className="grid gap-3">
            {availableActions.map(({ label, description, to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(11,31,58,0.025)] transition duration-200 hover:border-gold-200 hover:shadow-soft"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700 transition group-hover:bg-gold-50 group-hover:text-gold-700">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
                </span>
                <ArrowRight
                  size={16}
                  className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600"
                  aria-hidden="true"
                />
              </Link>
            ))}
            {availableActions.length === 0 && (
              <Card className="p-6">
                <EmptyState
                  title="Aucune action disponible"
                  description="Les actions rapides apparaîtront selon les accès de votre profil."
                />
              </Card>
            )}
          </div>
          <Link
            to="/interventions"
            className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-navy-700 transition hover:text-gold-700"
          >
            Explorer les modules
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="font-heading text-base font-semibold text-navy-950">Activité récente</h2>
            <p className="mt-1 text-xs text-slate-500">Les événements importants apparaîtront ici.</p>
          </div>
          <Card className="flex min-h-[260px] items-center justify-center border-dashed border-slate-300/90 bg-white/70 p-6 shadow-none">
            <EmptyState
              icon={<Plus size={20} aria-hidden="true" />}
              title="Votre activité apparaîtra ici"
              description="Une fois les modules opérationnels, vous retrouverez ici les dernières mises à jour."
            />
          </Card>
        </section>
      </div>
    </>
  )
}
