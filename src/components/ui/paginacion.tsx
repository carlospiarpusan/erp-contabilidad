'use client'

import { Button } from './button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginacionProps {
  total: number
  limit: number
  offset: number
  onChange: (offset: number) => void
}

export function Paginacion({ total, limit, offset, onChange }: PaginacionProps) {
  const pagina = Math.floor(offset / limit) + 1
  const totalPaginas = Math.ceil(total / limit)

  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
      <span>
        Mostrando {offset + 1}–{Math.min(offset + limit, total)} de {total.toLocaleString('es-CO')}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina <= 1}
          onClick={() => onChange(offset - limit)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 font-medium dark:text-gray-200">
          {pagina} / {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina >= totalPaginas}
          onClick={() => onChange(offset + limit)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
