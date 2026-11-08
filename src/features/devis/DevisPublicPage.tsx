import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Card, Spinner } from '@/components/ui'
import { fetchSharedQuote } from './useDevis'
import { quoteStatusLabels } from './types'

const money = (cents: number) => new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(cents / 100)

export function DevisPublicPage() {
  const { token = '' } = useParams()
  const query = useQuery({
    queryKey: ['shared-quote', token],
    queryFn: () => fetchSharedQuote(token),
    enabled: token.length > 0,
  })

  if (query.isLoading) return <Card className="p-8"><Spinner label="Chargement du devis partagé" /></Card>
  if (query.error || !query.data) return <Card className="p-8 text-sm text-slate-600">Ce lien de devis est invalide ou n’est plus disponible.</Card>

  const quote = query.data
  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <Card className="p-6 sm:p-8">
      <header className="flex flex-wrap justify-between gap-4 border-b border-slate-200 pb-5">
        <div><p className="text-xs uppercase tracking-wide text-slate-500">Devis</p><h1 className="mt-1 text-2xl font-bold">{quote.number} · version {quote.revision}</h1></div>
        <div className="text-sm text-slate-600"><p>{quoteStatusLabels[quote.status]}</p><p>Émis le {quote.issueDate}</p><p>Valable jusqu’au {quote.validUntil || '—'}</p></div>
      </header>
      <section className="py-5"><h2 className="font-semibold">{quote.client.name}</h2><p className="text-sm text-slate-600">{[quote.client.address, quote.client.city].filter(Boolean).join(', ')}</p>{quote.client.ice && <p className="text-sm text-slate-600">ICE : {quote.client.ice}</p>}</section>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm">
        <thead className="border-y border-slate-200 text-xs uppercase text-slate-500"><tr><th className="py-3">Désignation</th><th className="py-3">Qté</th><th className="py-3">Prix unitaire HT</th><th className="py-3">TVA</th></tr></thead>
        <tbody>{quote.lines.map((line) => <tr key={line.id} className="border-b border-slate-100"><td className="py-3">{line.designation}<small className="block text-slate-500">{line.reference}</small></td><td className="py-3">{line.quantity} {line.unit}</td><td className="py-3">{money(line.unitPriceCents)}</td><td className="py-3">{line.vatPercent} %</td></tr>)}</tbody>
      </table></div>
      <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm"><p className="flex justify-between"><span>Total HT</span><strong>{money(quote.totals.totalHTCents)}</strong></p><p className="flex justify-between"><span>TVA</span><strong>{money(quote.totals.totalVATCents)}</strong></p><p className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Total TTC</span><strong>{money(quote.totals.totalTTCCents)}</strong></p></div>
      {quote.notes && <section className="mt-6"><h2 className="font-semibold">Notes</h2><p className="whitespace-pre-wrap text-sm text-slate-600">{quote.notes}</p></section>}
      {quote.conditions && <section className="mt-4"><h2 className="font-semibold">Conditions</h2><p className="whitespace-pre-wrap text-sm text-slate-600">{quote.conditions}</p></section>}
    </Card>
  </main>
}
