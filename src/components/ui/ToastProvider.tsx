import { useEffect } from 'react'
import { CircleCheck, CircleX, X } from 'lucide-react'
import { useToastStore } from '@/hooks/useToast'

export function ToastProvider() {
  const items = useToastStore((state) => state.items)
  const dismiss = useToastStore((state) => state.dismiss)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && items.length > 0) dismiss(items[items.length - 1].id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dismiss, items])

  return (
    <div
      className="fixed right-4 top-4 z-[100] flex w-[min(100%-2rem,24rem)] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.kind === 'error' ? 'alert' : 'status'}
          className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800 shadow-card"
        >
          {item.kind === 'success' ? (
            <CircleCheck size={18} className="shrink-0 text-success-700" aria-hidden="true" />
          ) : (
            <CircleX size={18} className="shrink-0 text-danger-700" aria-hidden="true" />
          )}
          <p className="flex-1 leading-5">{item.message}</p>
          <button
            type="button"
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fermer la notification"
            onClick={() => dismiss(item.id)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
