export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Truck, Package, Clock } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string }>
}

export default async function RemisionesPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const estado = sp.estado || ''

  const supabase = await createClient()

  // Query documentos with tipo='remision' — returns empty if none exist yet
  let q = supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, estado, total, observaciones, cliente:cliente_id(razon_social)', { count: 'exact' })
    .eq('tipo', 'remision')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (estado) q = q.eq('estado', estado)

  const { data, count } = await q
  const remisiones = data ?? []
  const totalValor  = remisiones.reduce((s, r) => s + (r.total ?? 0), 0)

  const ESTADOS = [
    { key: '', label: 'Todas' },
    { key: 'borrador',  label: 'Borrador' },
    { key: 'enviada',   label: 'Enviada' },
    { key: 'entregada', label: 'Entregada' },
    { key: 'cancelada', label: 'Cancelada' },
  ]

  const BADGE: Record<string, string> = {
    borrador:  'bg-gray-100 text-gray-600',
    enviada:   'bg-blue-100 text-blue-700',
    entregada: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-600',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
            <Truck className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Remisiones</h1>
            <p className="text-sm text-gray-500">{count ?? 0} remisión{(count ?? 0) !== 1 ? 'es' : ''} en el período</p>
          </div>
        </div>
        <Link href="/ventas/remisiones/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 transition-colors">
          <Package className="h-4 w-4" /> Nueva remisión
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Estado</label>
          <select name="estado" defaultValue={estado}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
            {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-cyan-600 text-white text-sm hover:bg-cyan-700">Aplicar</button>
          <Link href="/ventas/remisiones" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Total remisiones</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Valor total</p>
          <p className="text-2xl font-bold font-mono text-cyan-700 mt-0.5">{formatCOP(totalValor)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600 mt-0.5">
            {remisiones.filter(r => r.estado === 'enviada' || r.estado === 'borrador').length}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        {remisiones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50">
              <Clock className="h-7 w-7 text-cyan-400" />
            </div>
            <p className="font-medium text-gray-700">No hay remisiones en este período</p>
            <p className="text-sm text-gray-400">Las remisiones aparecerán aquí una vez creadas</p>
            <Link href="/ventas/remisiones/nueva"
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
              <Package className="h-4 w-4" /> Crear primera remisión
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {remisiones.map(r => {
                const cliente = r.cliente as { razon_social?: string } | null
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{r.prefijo}{r.numero}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFecha(r.fecha)}</td>
                    <td className="px-4 py-3 text-gray-800">{cliente?.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCOP(r.total ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
