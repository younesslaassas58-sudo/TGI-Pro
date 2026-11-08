import { ArrowRight, Building2, ShieldCheck, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card } from '@/components/ui'

export function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-navy-100/70 blur-3xl"
      />
      <Card className="relative w-full max-w-3xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-navy-900 via-navy-700 to-gold-500" />
        <div className="p-7 sm:p-10">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-3" aria-label="TGI-Pro, accueil">
              <span className="flex size-11 items-center justify-center rounded-xl bg-navy-900 text-white shadow-soft">
                <Building2 size={22} aria-hidden="true" />
              </span>
              <span className="font-heading text-xl font-bold tracking-tight text-navy-950">
                TGI<span className="text-gold-600">-Pro</span>
              </span>
            </Link>
            <Badge variant="success">Fondations prêtes</Badge>
          </header>

          <section className="mt-12 max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-gold-700">
              TGI Ascenseurs
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-navy-950 sm:text-4xl">
              La gestion de vos ascenseurs, en toute maîtrise.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Une plateforme dédiée au suivi des installations, de la maintenance et des équipes
              terrain.
            </p>
          </section>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <Wrench className="shrink-0 text-navy-700" size={18} aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700">Interventions suivies</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <Building2 className="shrink-0 text-navy-700" size={18} aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700">Parc centralisé</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5">
              <ShieldCheck className="shrink-0 text-success-700" size={18} aria-hidden="true" />
              <span className="text-sm font-medium text-slate-700">Données sécurisées</span>
            </div>
          </div>

          <footer className="mt-9 flex flex-col gap-5 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name="Équipe TGI" size="md" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Espace TGI Ascenseurs</p>
                <p className="mt-0.5 text-xs text-slate-500">Votre outil de gestion métier</p>
              </div>
            </div>
            <Button type="button" className="self-start sm:self-auto">
              Découvrir la plateforme
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </footer>
        </div>
      </Card>
    </main>
  )
}
