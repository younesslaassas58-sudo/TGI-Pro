import { useMemo, useState } from 'react'
import { Card } from '@/components/ui'
import { useCompanySettings } from '@/features/parametres/useCompanySettings'
import { DocumentEditor } from './DocumentEditor'
import { createDemoModel, createStressTestModel } from './demoModel'

export function DocumentDemoPage() {
  const { settings, isLoading, error } = useCompanySettings()
  const [stressTest, setStressTest] = useState(false)
  const initialModel = useMemo(
    () => (stressTest ? createStressTestModel(settings) : createDemoModel(settings)),
    [settings, stressTest],
  )

  if (isLoading) {
    return <Card className="h-96 animate-pulse bg-slate-100 p-6" aria-label="Chargement des paramètres de la société" />
  }

  if (error) {
    return (
      <Card className="p-6 text-sm text-danger-700">
        Impossible de charger les paramètres de la société nécessaires au document.
      </Card>
    )
  }

  return (
    <DocumentEditor
      initialModel={initialModel}
      onLoadStressTest={() => setStressTest((value) => !value)}
    />
  )
}
