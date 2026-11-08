import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  beforeClose?: () => boolean
}

export function Modal({ open, onClose, title, children, className, beforeClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  function closeDialog() {
    if (beforeClose && !beforeClose()) return
    dialogRef.current?.close()
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'm-auto w-[min(100%-2rem,32rem)] rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-navy-950/50',
        className,
      )}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (beforeClose && !beforeClose()) event.preventDefault()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog()
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 id={titleId} className="font-heading text-lg font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Fermer la fenêtre"
          onClick={closeDialog}
        >
          <X aria-hidden="true" size={18} />
        </Button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
