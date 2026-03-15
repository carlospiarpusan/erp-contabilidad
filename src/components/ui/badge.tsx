import * as React from 'react'
import { cn } from '@/utils/cn'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-400/20',
    warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-400/20',
    danger: 'bg-red-50 text-red-700 ring-1 ring-red-600/10 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-400/20',
    info: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/10 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-400/20',
    outline: 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge }
