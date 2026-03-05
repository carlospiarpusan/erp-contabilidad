export const dynamic = 'force-dynamic'

import { getOrdenesCompra, getEstadisticasOrdenes } from '@/lib/db/cotizaciones'
import { ShoppingCart, Plus } from 'lucide-react'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ estado?: string }>
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger'> = {
  borrador: 'outline',
  aprobada: 'warning',
  recibida: 'success',
  cancelada: 'danger',
}

export default async function OrdenesCompraPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const estado = sp.estado ?? ''

  const [{ ordenes }, stats] = await Promise.all([
    getOrdenesCompra({ estado: estado || undefined, limit: 50 }),
    getEstadisticasOrdenes(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <ShoppingCart className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Órdenes de Compra</h1>
          <p className="text-sm text-gray-500">Solicitudes de compra a proveedores</p>
        </div>
        <Link href="/compras/ordenes/nueva">
          <button className="flex items-center gap-1.5 rounded-lg bg-orange-600 text-white text-sm px-4 py-2 hover:bg-orange-700 transition-colors">
            <Plus className="h-4 w-4" /> Nueva orden
          </button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', val: stats.total },
          { label: 'Borrador', val: stats.borrador },
          { label: 'Aprobadas', val: stats.aprobada },
          { label: 'Valor', val: formatCOP(stats.valor), color: 'text-orange-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color ?? 'text-gray-900'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit">
        {[
          { value: '', label: 'Todas' },
          { value: 'borrador', label: 'Borrador' },
          { value: 'aprobada', label: 'Aprobada' },
          { value: 'recibida', label: 'Recibida' },
          { value: 'cancelada', label: 'Cancelada' },
        ].map(e => (
          <Link key={e.value}
            href={e.value ? `/compras/ordenes?estado=${e.value}` : '/compras/ordenes'}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${estado === e.value ? 'bg-orange-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {e.label}
          </Link>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Entrega</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Proveedor</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ordenes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No hay órdenes de compra</td></tr>
            ) : ordenes.map(o => {
              const p = o.proveedor as { razon_social?: string } | null
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-700">{o.prefijo}{o.numero}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(o.fecha)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{o.fecha_vencimiento ? formatFecha(o.fecha_vencimiento as string) : '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{p?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={BADGE_ESTADO[o.estado] ?? 'outline'}>{o.estado}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{formatCOP(o.total ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/compras/ordenes/${o.id}`} className="text-blue-600 hover:underline text-xs">Ver</Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
