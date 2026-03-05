export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { ShieldCheck, AlertCircle, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string }>
}

export default async function GarantiasPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const estado = sp.estado || ''

  const supabase = await createClient()

  // Query garantias table if it exists, otherwise graceful empty state
  const { data, count, error } = await supabase
    .from('garantias')
    .select('id, numero, fecha, estado, descripcion, valor, cliente:cliente_id(razon_social), factura:factura_id(prefijo, numero)', { count: 'exact' })
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })
    .limit(200)

  const garantias = error ? [] : (data ?? [])
  const hayError  = !!error

  const BADGE: Record<string, string> = {
    abierta:    'bg-amber-100 text-amber-700',
    en_proceso: 'bg-blue-100 text-blue-700',
    resuelta:   'bg-green-100 text-green-700',
    rechazada:  'bg-red-100 text-red-600',
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Garantías y Devoluciones</h1>
            <p className="text-sm text-gray-500">Gestión de reclamaciones de clientes</p>
          </div>
        </div>
        <Link href="/ventas/garantias/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva garantía
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Estado</label>
          <select name="estado" defaultValue={estado}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Todos</option>
            <option value="abierta">Abierta</option>
            <option value="en_proceso">En proceso</option>
            <option value="resuelta">Resuelta</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">Aplicar</button>
          <Link href="/ventas/garantias" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Limpiar</Link>
        </div>
      </form>

      {hayError ? (
        /* Tabla no existe aún — mostrar onboarding */
        <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
              <ShieldCheck className="h-7 w-7 text-emerald-500" />
            </div>
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Módulo de Garantías</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
            Registra devoluciones, cambios y reclamaciones de tus clientes, vinculadas a facturas de venta.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-600 mb-6">
            <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 text-amber-500" /> Reclamaciones</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Devoluciones</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-blue-500" /> Cambios de producto</span>
          </div>
          <p className="text-xs text-gray-400">Este módulo requiere activación — contacta al administrador del sistema.</p>
        </div>
      ) : garantias.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <div className="flex justify-center mb-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <ShieldCheck className="h-7 w-7 text-gray-300" />
            </div>
          </div>
          <p className="font-medium text-gray-700">No hay garantías en este período</p>
          <p className="text-sm text-gray-400 mt-1">Las reclamaciones de clientes aparecerán aquí</p>
          <Link href="/ventas/garantias/nueva"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Registrar garantía
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
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Factura ref.</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {garantias.map((g: any) => {
                const cliente = g.cliente as { razon_social?: string } | null
                const factura = g.factura as { prefijo?: string; numero?: number } | null
                return (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{g.numero}</td>
                    <td className="px-4 py-3 text-gray-600">{formatFecha(g.fecha)}</td>
                    <td className="px-4 py-3 text-gray-800">{cliente?.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{factura ? `${factura.prefijo}${factura.numero}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{g.descripcion ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[g.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                        {g.estado?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">{formatCOP(g.valor ?? 0)}</td>
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
