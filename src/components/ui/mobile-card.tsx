import { cn, cardCls } from '@/utils/cn'

interface MobileCardProps {
  onClick?: () => void
  children: React.ReactNode
  className?: string
}

export function MobileCard({ onClick, children, className }: MobileCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        cardCls,
        'w-full p-4 text-left transition-colors',
        onClick && 'active:bg-gray-50 dark:active:bg-gray-800',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
