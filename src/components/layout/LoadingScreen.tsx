import { Spinner } from '@/components/ui'

export function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5" aria-busy="true">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-navy-900 font-heading text-sm font-bold text-gold-300 shadow-soft">
            TGI
          </span>
          <Spinner label="Chargement de votre espace" />
          <div className="space-y-2" aria-hidden="true">
            <div className="mx-auto h-3 w-36 animate-pulse rounded-full bg-slate-200" />
            <div className="mx-auto h-2.5 w-52 animate-pulse rounded-full bg-slate-100" />
          </div>
          <p className="text-sm text-slate-500">Préparation de votre espace sécurisé…</p>
        </div>
      </div>
    </main>
  )
}
