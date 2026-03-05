export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Wrench, Plus, Clock } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string }>
}

export default async function ServiciosPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const estado = sp.estado || ''

  const supabase = await createClient()

  // Query ordenes_servicio table if it exists, graceful empty otherwise
  const { data, count, error } = await supabase
    .from('ordenes_servicio')
    .select('id, numero, fecha, estado, descripcion, total, cliente:cliente_id(razon_social), tecnico:tecnico_id(nombre)', { count: 'exact' })
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .limit(200)

  const ordenes = error ? [] : (data ?? [])
  const hayError = !!error

  const BADGE: Record<string, string> = {
    recibida:   'bg-gray-100 text-gray-600',
    diagnostico:'bg-amber-100 text-amber-700',
    en_proceso: 'bg-blue-100 text-blue-700',
    listo:      'bg-purple-100 text-purple-700',
    entregado:  'bg-green-100 text-green-700',
    cancelado:  'bg-red-100 text-red-600',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Wrench className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Servicio Técnico</h1>
            <p className="text-sm text-gray-500">Órdenes de servicio y reparaciones</p>
          </div>
        </div>
        <Link href="/ventas/servicios/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva orden
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Estado</label>
          <select name="estado" defaultValue={estado}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
            <option value="">Todos</option>
            <option value="recibida">Recibida</option>
            <option value="diagnostico">Diagnóstico</option>
            <option value="en_proceso">En proceso</option>
            <option value="listo">Listo para entrega</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700">Aplicar</button>
          <Link href="/ventas/servicios" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs */}
      {!hayError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',           val: count ?? 0,                                  color: 'text-gray-900', mono: false },
            { label: 'En proceso',      val: ordenes.filter(o => o.estado === 'en_proceso').length, color: 'text-blue-700', mono: false },
            { label: 'Listos',          val: ordenes.filter(o => o.estado === 'listo').length,      color: 'text-purple-700', mono: false },
            { label: 'Valor facturado', val: formatCOP(ordenes.reduce((s, o) => s + (o.total ?? 0), 0)), color: 'text-violet-700', mono: true },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${k.color} ${k.mono ? 'font-mono' : ''}`}>{k.val}</p>
            </div>
          ))}
        </div>
      )}

      {hayError ? (
        /* Tabla no existe aún */
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50 p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
              <Wrench className="h-7 w-7 text-violet-500" />
            </div>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Módulo de Servicio Técnico</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
            Gestiona órdenes de reparación, seguimiento técnico y entrega de equipos o productos a clientes.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600 mb-6">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-500" /> Recepción</span>
            <span className="flex items-center gap-1.5"><Wrench className="h-4 w-4 text-blue-500" /> Diagnóstico</span>
            <span className="flex items-center gap-1.5"><Wrench className="h-4 w-4 text-violet-500" /> Reparación</span>
            <span className="flex items-center gap-1.5"><Wrench className="h-4 w-4 text-green-500" /> Entrega</span>
          </div>
          <p className="text-xs text-gray-400">Este módulo requiere activación — contacta al administrador del sistema.</p>
        </div>
      ) : ordenes.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Wrench className="h-7 w-7 text-gray-300" />
            </div>
          </div>
          <p className="font-medium text-gray-700">No hay órdenes de servicio en este período</p>
          <p className="text-sm text-gray-400 mt-1">Las reparaciones y servicios aparecerán aquí</p>
          <Link href="/ventas/servicios/nueva"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            <Plus className="h-4 w-4" /> Crear orden de servicio
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Técnico</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map((o: any) => {
                const cliente = o.cliente as { razon_social?: string } | null
                const tecnico = o.tecnico as { nombre?: string } | null
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{o.numero}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFecha(o.fecha)}</td>
                    <td className="px-4 py-3 text-gray-800">{cliente?.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{tecnico?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{o.descripcion ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[o.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {o.estado?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">{formatCOP(o.total ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
