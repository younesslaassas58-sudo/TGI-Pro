import { useEffect, useState } from 'react'
import {
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Gauge,
  HardHat,
  PackageCheck,
  PackageOpen,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { Avatar, Badge } from '@/components/ui'
import { useAuth } from '@/features/auth/authStore'
import { usePermission } from '@/features/auth/usePermission'
import type { AppModule } from '@/lib/permissions'
import { displayNameOrEmail, roleLabel } from '@/lib/user'
import { cn } from '@/lib/utils'

interface NavigationItem {
  label: string
  to: string
  icon: typeof Gauge
  module?: AppModule
}

interface NavigationGroup {
  label: string
  items: NavigationItem[]
}

const groups: NavigationGroup[] = [
  {
    label: 'Pilotage',
    items: [{ label: 'Tableau de bord', to: '/', icon: Gauge }],
  },
  {
    label: 'Commercial',
    items: [
      { label: 'Clients', to: '/clients', icon: Users, module: 'clients' },
      { label: 'Parc d’ascenseurs', to: '/parc', icon: Building2, module: 'parc' },
      { label: 'Devis', to: '/devis', icon: FileText, module: 'devis' },
      { label: 'Bons de commande', to: '/commandes', icon: PackageOpen, module: 'commandes' },
      { label: 'Bons de livraison', to: '/livraisons', icon: PackageCheck, module: 'livraisons' },
      { label: 'Recouvrement', to: '/recouvrement', icon: ClipboardList, module: 'recouvrement' },
    ],
  },
  {
    label: 'Opérations',
    items: [
      { label: 'Interventions', to: '/interventions', icon: Wrench, module: 'interventions' },
      { label: 'Techniciens', to: '/techniciens', icon: HardHat, module: 'techniciens' },
      { label: 'Stock', to: '/stock', icon: Boxes, module: 'stock' },
    ],
  },
  {
    label: 'Gestion',
    items: [{ label: 'Paramètres', to: '/parametres', icon: Settings, module: 'parametres' }],
  },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

function NavigationLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem
  collapsed: boolean
  onNavigate: () => void
}) {
  const canView = usePermission(item.module ?? 'clients', 'voir')
  if (item.module && !canView) return null
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-all duration-200',
          collapsed && 'lg:justify-center lg:px-0',
          isActive
            ? 'bg-white/[0.09] text-gold-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
            : 'text-slate-300 hover:bg-white/[0.055] hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-gold-400 shadow-[0_0_10px_rgba(201,162,39,0.55)]" />
          )}
          <Icon
            size={17}
            className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-gold-300' : 'text-slate-400 group-hover:text-slate-200',
            )}
            aria-hidden="true"
          />
          <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const profile = useAuth((state) => state.profile)

  useEffect(() => {
    if (!mobileOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen, onClose])

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy-950/60 backdrop-blur-[2px] lg:hidden"
          aria-label="Fermer le menu"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'sidebar-surface fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden text-white transition-[width,transform,visibility] duration-200 lg:static lg:z-auto lg:translate-x-0',
          collapsed && 'lg:w-[76px]',
          mobileOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible',
        )}
        aria-label="Menu principal"
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.08] px-4">
          <Link
            to="/"
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
            aria-label="TGI-Pro, tableau de bord"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold-300/30 bg-gradient-to-br from-gold-300 to-gold-500 font-heading text-xs font-extrabold text-navy-950 shadow-[0_5px_15px_rgba(201,162,39,0.15)]">
              TGI
            </span>
            <span className={cn('font-heading text-lg font-bold tracking-tight', collapsed && 'lg:hidden')}>
              TGI<span className="text-gold-400">-Pro</span>
            </span>
          </Link>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fermer le menu"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Navigation principale">
          {groups.map((group) => (
            <section key={group.label}>
              <h2
                className={cn(
                  'mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500',
                  collapsed && 'lg:sr-only',
                )}
              >
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavigationLink
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/[0.08] p-3">
          {profile && (
            <div className={cn('flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.045] p-3', collapsed && 'lg:justify-center lg:border-transparent lg:bg-transparent lg:p-1')}>
              <Avatar
                name={profile.displayName}
                src={profile.photoURL}
                size="sm"
                className="ring-1 ring-white/15"
              />
              <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
                <p className="truncate text-xs font-semibold text-slate-100">
                  {displayNameOrEmail(profile)}
                </p>
                <Badge className="mt-1 border-white/10 bg-white/[0.08] text-[10px] text-slate-300 ring-white/10">
                  {roleLabel(profile.role)}
                </Badge>
              </div>
              <Link
                to="/profil"
                title="Mon profil"
                aria-label="Mon profil"
                className={cn('rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white', collapsed && 'lg:hidden')}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            </div>
          )}
          <p className={cn('mt-3 px-2 text-[10px] text-slate-600', collapsed && 'lg:hidden')}>
            TGI Ascenseurs · Espace professionnel
          </p>
        </div>
      </aside>
    </>
  )
}
