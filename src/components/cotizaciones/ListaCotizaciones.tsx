'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Eye, Plus } from 'lucide-react'
import Link from 'next/link'

interface Cotizacion {
  id: string; numero: number; prefijo: string; fecha: string; fecha_vencimiento?: string | null
  estado: string; total: number
  cliente?: { razon_social?: string } | null
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger'> = {
  borrador:   'outline',
  aprobada:   'warning',
  convertida: 'success',
  cancelada:  'danger',
}

const ESTADOS = [
  { value: '',           label: 'Todos' },
  { value: 'borrador',   label: 'Borrador' },
  { value: 'aprobada',   label: 'Aprobada' },
  { value: 'convertida', label: 'Convertida' },
  { value: 'cancelada',  label: 'Cancelada' },
]

interface Props {
  cotizaciones: Cotizacion[]
  total: number
  estadoFiltro: string
}

export function ListaCotizaciones({ cotizaciones, total, estadoFiltro: estadoInicial }: Props) {
  const [estado, setEstado] = useState(estadoInicial)

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {ESTADOS.map(e => (
            <Link key={e.value} href={e.value ? `/ventas/cotizaciones?estado=${e.value}` : '/ventas/cotizaciones'}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${estado === e.value ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'}`}
              onClick={() => setEstado(e.value)}>
              {e.label}
            </Link>
          ))}
        </div>
        <Link href="/ventas/cotizaciones/nueva" className="ml-auto">
          <Button size="sm" variant="success"><Plus className="h-4 w-4 mr-1" />Nueva cotización</Button>
        </Link>
      </div>

      <p className="text-sm text-gray-500">{total} cotización{total !== 1 ? 'es' : ''}</p>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Válida hasta</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cotizaciones.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No hay cotizaciones</td></tr>
            ) : cotizaciones.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono font-medium text-gray-700">{c.prefijo}{c.numero}</td>
                <td className="px-4 py-3 text-gray-600">{formatFecha(c.fecha)}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.fecha_vencimiento ? formatFecha(c.fecha_vencimiento) : '—'}</td>
                <td className="px-4 py-3 text-gray-900">{(c.cliente as any)?.razon_social ?? '—'}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={BADGE_ESTADO[c.estado] ?? 'outline'}>{c.estado}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{formatCOP(c.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/ventas/cotizaciones/${c.id}`}>
                    <Button size="sm" variant="outline"><Eye className="h-4 w-4" /></Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
