'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface Gasto {
  id: string
  numero: number
  prefijo: string
  fecha: string
  total: number
  observaciones?: string | null
  acreedor?: { razon_social: string } | null
  forma_pago?: { descripcion: string } | null
  lineas?: { descripcion?: string | null; total: number }[]
}

interface Props { gastos: Gasto[]; total: number }

export function ListaGastos({ gastos: inicial, total }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const filtrados = inicial.filter(g => {
    const desc = (g.lineas?.[0]?.descripcion ?? g.observaciones ?? '').toLowerCase()
    const matchBusqueda = !busqueda || desc.includes(busqueda.toLowerCase()) ||
      (g.acreedor?.razon_social ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchDesde = !desde || g.fecha >= desde
    const matchHasta = !hasta || g.fecha <= hasta
    return matchBusqueda && matchDesde && matchHasta
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar gasto o acreedor…"
          className="flex-1 min-w-48 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Desde" title="Desde" />
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="Hasta" title="Hasta" />
        <Link href="/gastos/nuevo">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nuevo gasto
          </Button>
        </Link>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">N°</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Acreedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Forma pago</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No hay gastos registrados</td></tr>
            ) : filtrados.map(g => (
              <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50 cursor-pointer" onClick={() => { window.location.href = `/gastos/${g.id}` }}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{g.prefijo}{g.numero}</td>
                <td className="px-4 py-3 text-gray-700">{formatFecha(g.fecha)}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {g.lineas?.[0]?.descripcion ?? g.observaciones ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {(g.acreedor as { razon_social?: string } | null)?.razon_social ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {(g.forma_pago as { descripcion?: string } | null)?.descripcion ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-purple-700">
                  {formatCOP(g.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {total} gasto{total !== 1 ? 's' : ''} en total · {formatCOP(filtrados.reduce((s, g) => s + g.total, 0))} filtrado{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
