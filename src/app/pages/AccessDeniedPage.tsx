import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'

export function AccessDeniedPage() {
  return (
    <>
      <PageHeader title="Accès refusé" />
      <Card className="p-6 sm:p-8">
        <p className="text-sm text-slate-600">
          Votre rôle ne permet pas d’accéder à ce module.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-navy-900 px-4 text-sm font-semibold text-white hover:bg-navy-800"
        >
          Retour au tableau de bord
        </Link>
      </Card>
    </>
  )
}
