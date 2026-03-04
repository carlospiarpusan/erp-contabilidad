import { cn } from '@/utils/cn'
import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  titulo: string
  valor: string
  subtitulo?: string
  icono: LucideIcon
  color: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  tendencia?: number // porcentaje vs mes anterior
}

const colores = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-600 text-white',
    text: 'text-blue-700',
    border: 'border-blue-100',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-600 text-white',
    text: 'text-green-700',
    border: 'border-green-100',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-500 text-white',
    text: 'text-orange-700',
    border: 'border-orange-100',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'bg-red-600 text-white',
    text: 'text-red-700',
    border: 'border-red-100',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-600 text-white',
    text: 'text-purple-700',
    border: 'border-purple-100',
  },
}

export function KPICard({ titulo, valor, subtitulo, icono: Icon, color, tendencia }: KPICardProps) {
  const c = colores[color]

  return (
    <div className={cn('rounded-xl border p-5 shadow-sm', c.bg, c.border)}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-gray-500">{titulo}</p>
          <p className={cn('text-2xl font-bold', c.text)}>{valor}</p>
          {subtitulo && <p className="text-xs text-gray-400">{subtitulo}</p>}
        </div>
        <div className={cn('rounded-xl p-2.5', c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {tendencia !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          <span className={cn('text-xs font-medium', tendencia >= 0 ? 'text-green-600' : 'text-red-600')}>
            {tendencia >= 0 ? '↑' : '↓'} {Math.abs(tendencia)}%
          </span>
          <span className="text-xs text-gray-400">vs mes anterior</span>
        </div>
      )}
    </div>
  )
}
