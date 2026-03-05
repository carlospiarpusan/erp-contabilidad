export const dynamic = 'force-dynamic'

import { getRemisiones, getEstadisticasRemisiones } from '@/lib/db/remisiones'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Truck, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string }>
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  borrador:  'outline',
  enviada:   'info',
  entregada: 'success',
  facturada: 'default',
  cancelada: 'danger',
}

const TABS = [
  { key: '',          label: 'Todas' },
  { key: 'borrador',  label: 'Borrador' },
  { key: 'enviada',   label: 'Enviada' },
  { key: 'entregada', label: 'Entregada' },
  { key: 'facturada', label: 'Facturada' },
  { key: 'cancelada', label: 'Cancelada' },
]

export default async function RemisionesPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const hoy    = new Date().toISOString().split('T')[0]
  const anio   = new Date().getFullYear()
  const desde  = sp.desde  || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const estado = sp.estado || ''

  const [{ remisiones, total }, stats] = await Promise.all([
    getRemisiones({ estado: estado || undefined, desde, hasta, limit: 100 }),
    getEstadisticasRemisiones(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
            <Truck className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Remisiones</h1>
            <p className="text-sm text-gray-500">{total} remisión{total !== 1 ? 'es' : ''} en el período</p>
          </div>
        </div>
        <Link href="/ventas/remisiones/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva remisión
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Enviadas</p>
          <p className="text-2xl font-bold text-blue-600 mt-0.5">{stats.enviada}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Entregadas</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{stats.entregada}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Valor total</p>
          <p className="text-xl font-bold font-mono text-cyan-700 mt-0.5">{formatCOP(stats.valor)}</p>
        </div>
      </div>

      {/* Filtros y tabs */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100">
          {TABS.map(t => {
            const params = new URLSearchParams({ desde, hasta })
            if (t.key) params.set('estado', t.key)
            return (
              <Link key={t.key} href={`/ventas/remisiones?${params}`}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  estado === t.key ? 'bg-cyan-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}>
                {t.label}
              </Link>
            )
          })}
          <form className="ml-auto flex gap-2">
            <input type="hidden" name="estado" value={estado} />
            <input type="date" name="desde" defaultValue={desde}
              className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            <input type="date" name="hasta" defaultValue={hasta}
              className="h-8 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500" />
            <button type="submit" className="h-8 px-3 rounded-lg bg-gray-100 text-xs text-gray-700 hover:bg-gray-200">Filtrar</button>
          </form>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Bodega</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {remisiones.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No hay remisiones en este período.{' '}
                  <Link href="/ventas/remisiones/nueva" className="text-cyan-600 hover:underline">Crear primera remisión</Link>
                </td>
              </tr>
            ) : remisiones.map(r => {
              const cliente = (r as any).cliente as { razon_social?: string } | null
              const bodega  = (r as any).bodega  as { nombre?: string } | null
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/ventas/remisiones/${r.id}`} className="font-mono text-cyan-600 hover:underline">
                      {r.prefijo}{r.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{cliente?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{bodega?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={BADGE_ESTADO[r.estado] ?? 'outline'}>{r.estado}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCOP(r.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
