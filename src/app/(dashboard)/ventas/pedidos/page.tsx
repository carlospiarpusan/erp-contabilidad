export const dynamic = 'force-dynamic'

import { getPedidos, getEstadisticasPedidos } from '@/lib/db/pedidos'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps { searchParams: Promise<{ estado?: string }> }

const BADGE: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  pendiente: 'warning',
  en_proceso: 'info',
  despachado: 'default',
  facturado: 'success',
  cancelado: 'danger',
}

export default async function PedidosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const estado = sp.estado ?? ''

  const [{ pedidos }, stats] = await Promise.all([
    getPedidos({ estado: estado || undefined, limit: 50 }),
    getEstadisticasPedidos(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <ClipboardList className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Pedidos de Venta</h1>
          <p className="text-sm text-gray-500">Órdenes de compra de clientes</p>
        </div>
        <Link href="/ventas/pedidos/nueva">
          <button className="flex items-center gap-1.5 rounded-lg bg-purple-600 text-white text-sm px-4 py-2 hover:bg-purple-700 transition-colors">
            <Plus className="h-4 w-4" /> Nuevo pedido
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total', val: stats.total, color: '' },
          { label: 'Pendientes', val: stats.pendiente, color: 'text-yellow-700' },
          { label: 'En proceso', val: stats.en_proceso, color: 'text-blue-700' },
          { label: 'Despachados', val: stats.despachado, color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Valor pend.', val: formatCOP(stats.valor), color: 'text-purple-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.color || 'text-gray-900 dark:text-gray-100'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 w-fit flex-wrap">
        {[
          { value: '', label: 'Todos' },
          { value: 'pendiente', label: 'Pendiente' },
          { value: 'en_proceso', label: 'En proceso' },
          { value: 'despachado', label: 'Despachado' },
          { value: 'facturado', label: 'Facturado' },
          { value: 'cancelado', label: 'Cancelado' },
        ].map(e => (
          <Link key={e.value}
            href={e.value ? `/ventas/pedidos?estado=${e.value}` : '/ventas/pedidos'}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${estado === e.value ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'}`}>
            {e.label}
          </Link>
        ))}
      </div>

      <div className={cn(cardCls, 'overflow-hidden')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pedidos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No hay pedidos</td></tr>
            ) : pedidos.map(p => {
              const c = p.cliente as { razon_social?: string } | null
              return (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-700">{p.prefijo}{p.numero}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(p.fecha)}</td>
                  <td className="px-4 py-3 text-gray-900">{c?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={BADGE[p.estado] ?? 'outline'}>{p.estado.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{formatCOP(p.total ?? 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/ventas/pedidos/${p.id}`} className="text-blue-600 hover:underline text-xs">Ver</Link>
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
