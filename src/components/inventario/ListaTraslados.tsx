'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardCls, formatFecha } from '@/utils/cn'
import { Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const BADGE_ESTADO: Record<string, 'warning' | 'success' | 'danger'> = {
  pendiente:  'warning',
  completado: 'success',
  cancelado:  'danger',
}

interface Props {
  traslados: any[]
}

export function ListaTraslados({ traslados }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Link href="/inventario/traslados/nuevo">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nuevo traslado</Button>
        </Link>
      </div>

      <p className="text-sm text-gray-500">{traslados.length} traslado{traslados.length !== 1 ? 's' : ''}</p>

      {/* Tabla */}
      <div className={`${cardCls} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800/50 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">N.o</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Origen</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-semibold text-gray-500" />
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Destino</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-semibold text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {traslados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No hay traslados registrados</td>
              </tr>
            ) : traslados.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono font-medium text-gray-700 dark:text-gray-200">#{t.numero}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatFecha(t.fecha)}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.bodega_origen?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-center text-gray-400">
                  <ArrowRight className="inline h-4 w-4" />
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{t.bodega_destino?.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={BADGE_ESTADO[t.estado] ?? 'warning'}>{t.estado}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{t.observaciones ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
