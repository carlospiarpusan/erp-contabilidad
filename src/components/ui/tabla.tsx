import { cn } from '@/utils/cn'

interface TablaProps {
  columnas: { key: string; label: string; className?: string }[]
  children: React.ReactNode
  className?: string
}

export function Tabla({ columnas, children, className }: TablaProps) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800', className)}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          <tr>
            {columnas.map((col) => (
              <th key={col.key} className={cn('px-4 py-3 text-left', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">{children}</tbody>
      </table>
    </div>
  )
}

export function FilaTabla({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      className={cn(
        'transition-colors',
        onClick ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function CeldaTabla({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3 text-gray-700 dark:text-gray-300', className)}>{children}</td>
}
