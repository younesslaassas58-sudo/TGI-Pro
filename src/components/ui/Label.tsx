import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

export function Label({ required, className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('mb-1.5 inline-flex items-center gap-1 text-sm font-medium text-slate-700', className)}
      {...props}
    >
      {children}
      {required && (
        <span className="text-danger-600" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}
