import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-navy-900 via-navy-900 to-navy-800 text-white shadow-[0_6px_16px_rgba(11,31,58,0.16)] hover:-translate-y-0.5 hover:shadow-[0_9px_22px_rgba(11,31,58,0.22)] active:translate-y-0 disabled:from-navy-400 disabled:to-navy-500',
  secondary: 'bg-gold-500 text-white shadow-sm hover:bg-gold-600 disabled:bg-gold-300',
  outline:
    'border border-slate-300 bg-white text-navy-900 hover:border-navy-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'bg-transparent text-navy-800 hover:bg-navy-50 disabled:text-slate-400',
  danger: 'bg-danger-500 text-white shadow-sm hover:bg-danger-700 disabled:bg-danger-100',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 rounded-lg px-3 text-sm',
  md: 'min-h-11 rounded-xl px-4 text-sm',
  lg: 'min-h-12 rounded-xl px-5 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-200 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" label="Chargement" />}
      {children}
    </button>
  )
}
