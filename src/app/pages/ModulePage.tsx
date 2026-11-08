import { Construction } from 'lucide-react'
import { Card, EmptyState } from '@/components/ui'
import { PageHeader } from '@/components/layout/PageHeader'

export interface ModulePageProps {
  title: string
  description: string
}

export function ModulePage({ title, description }: ModulePageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={<Construction size={22} aria-hidden="true" />}
          title="Module en construction"
          description="Cet espace sera disponible dans une prochaine étape du projet."
        />
      </Card>
    </>
  )
}
