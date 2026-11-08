import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, LogOut, Menu, UserRound } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Badge } from '@/components/ui'
import { useToast } from '@/components/ui'
import { useAuth } from '@/features/auth/authStore'
import { displayNameOrEmail, roleLabel } from '@/lib/user'
import { Sidebar } from './Sidebar'

const pageTitles: Record<string, string> = {
  '/': 'Tableau de bord',
  '/clients': 'Clients',
  '/parc': 'Parc d’ascenseurs',
  '/techniciens': 'Techniciens',
  '/utilisateurs': 'Gestion des utilisateurs',
  '/interventions': 'Interventions',
  '/recouvrement': 'Recouvrement',
  '/devis': 'Devis',
  '/commandes': 'Bons de commande',
  '/livraisons': 'Bons de livraison',
  '/stock': 'Stock',
  '/parametres': 'Paramètres',
  '/profil': 'Mon profil',
  '/acces-refuse': 'Accès refusé',
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuPath, setUserMenuPath] = useState<string | null>(null)
  const profile = useAuth((state) => state.profile)
  const signOut = useAuth((state) => state.signOut)
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const pageTitle = pageTitles[location.pathname] ?? 'TGI-Pro'
  const userMenuOpen = userMenuPath === location.pathname
  const userName = profile ? displayNameOrEmail(profile) : ''

  useEffect(() => {
    if (!userMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuPath(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [userMenuOpen])

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Impossible de fermer la session. Veuillez réessayer.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
              aria-label="Ouvrir le menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="mb-1 hidden items-center gap-1.5 text-[11px] text-slate-400 sm:flex">
                <span>Espace de travail</span>
                <ChevronRight size={12} aria-hidden="true" />
                <span className="truncate text-slate-500">{pageTitle}</span>
              </div>
              <h1 className="truncate font-heading text-base font-semibold tracking-tight text-navy-950 sm:text-lg">
                {pageTitle}
              </h1>
            </div>
          </div>

          {profile && (
            <div className="relative ml-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-transparent p-1.5 text-left transition duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm sm:gap-3 sm:px-2"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={`Menu utilisateur : ${userName}`}
                onClick={() => setUserMenuPath((value) => (value === location.pathname ? null : location.pathname))}
              >
                <Avatar name={profile.displayName} src={profile.photoURL} size="sm" />
                <span className="hidden min-w-0 max-w-28 sm:block sm:max-w-36 md:max-w-48">
                  <span className="block truncate text-xs font-semibold text-slate-800">
                    {userName}
                  </span>
                  <Badge
                    className="mt-1"
                    variant={profile.role === 'directeur' ? 'gold' : 'default'}
                  >
                    {roleLabel(profile.role)}
                  </Badge>
                </span>
                <ChevronDown
                  size={15}
                  className="hidden text-slate-400 sm:block"
                  aria-hidden="true"
                />
              </button>
              {userMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    aria-label="Fermer le menu utilisateur"
                    onClick={() => setUserMenuPath(null)}
                  />
                  <div
                    className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-[0_16px_50px_-20px_rgba(11,31,58,0.28)]"
                    role="menu"
                  >
                    <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3">
                      <Avatar name={profile.displayName} src={profile.photoURL} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {userName}
                        </p>
                        <p className="truncate text-xs text-slate-500">{profile.email}</p>
                        <Badge
                          className="mt-1.5"
                          variant={profile.role === 'directeur' ? 'gold' : 'default'}
                        >
                          {roleLabel(profile.role)}
                        </Badge>
                      </div>
                    </div>
                    <Link
                      to="/profil"
                      role="menuitem"
                      className="mt-1 flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      onClick={() => setUserMenuPath(null)}
                    >
                      <UserRound size={16} aria-hidden="true" />
                      Mon profil
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-danger-700 transition hover:bg-danger-50"
                      onClick={handleSignOut}
                    >
                      <LogOut size={16} aria-hidden="true" />
                      Se déconnecter
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </header>
        <main className="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-slate-200/80 bg-white/80 px-4 py-3 text-center text-[11px] text-slate-400 backdrop-blur sm:px-6 lg:px-8">
          TGI-Pro <span className="mx-1.5 text-slate-300">·</span> Gestion TGI Ascenseurs
        </footer>
      </div>
    </div>
  )
}
