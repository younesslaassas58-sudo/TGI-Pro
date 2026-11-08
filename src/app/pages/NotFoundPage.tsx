import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <Card className="w-full max-w-lg p-8 text-center sm:p-12">
        <p className="font-heading text-6xl font-bold tracking-tight text-navy-900">404</p>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-slate-900">
          Page introuvable
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Cette page n’existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
        >
          Retour à l’accueil
        </Link>
      </Card>
    </main>
  )
}
