import { cn } from '@/lib/utils'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizes = {
  sm: 'size-4 border-2',
  md: 'size-6 border-[3px]',
  lg: 'size-9 border-4',
}

export function Spinner({ size = 'md', label = 'Chargement', className }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizes[size],
        className,
      )}
      role="status"
      aria-label={label}
    />
  )
}
