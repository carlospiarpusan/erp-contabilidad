export const dynamic = 'force-dynamic'

import { getRemisiones, getResumenRemisiones } from '@/lib/db/remisiones'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Truck } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; page?: string }>
}

const BADGE: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  enviada:   'bg-blue-100 text-blue-700',
  entregada: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
}

export default async function InformeRemisionesPage({ searchParams }: PageProps) {
  const PAGE_SIZE = 100
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const estado = sp.estado || ''
  const page = Math.max(1, Number(sp.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [{ remisiones, total }, resumen] = await Promise.all([
    getRemisiones({ desde, hasta, estado: estado || undefined, limit: PAGE_SIZE, offset }),
    getResumenRemisiones({ desde, hasta, estado: estado || undefined }),
  ])

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangoInicio = total === 0 ? 0 : offset + 1
  const rangoFin = Math.min(offset + PAGE_SIZE, total)

  function buildHref(nextPage: number) {
    const params = new URLSearchParams()
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    if (estado) params.set('estado', estado)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return query ? `/informes/remisiones?${query}` : '/informes/remisiones'
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Truck className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Informe de Remisiones</h1>
          <p className="text-sm text-gray-500">{total} remisión{total !== 1 ? 'es' : ''} en el período</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Estado</label>
          <select name="estado" defaultValue={estado}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
            <option value="entregada">Entregada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/informes/remisiones" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total remisiones', val: resumen.total.toString(), color: 'text-gray-900' },
          { label: 'Valor total', val: formatCOP(resumen.total_valor), color: 'text-purple-700', mono: true },
          { label: 'Entregadas', val: resumen.entregadas.toString(), color: 'text-green-700' },
          { label: 'Valor entregado', val: formatCOP(resumen.valor_entregado), color: 'text-green-700', mono: true },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.mono ? 'font-mono' : ''} ${k.color}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
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
            {remisiones.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Sin remisiones en el período</td></tr>
            ) : remisiones.map(r => {
              const c = r.cliente as { id?: string; razon_social?: string } | null
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-700">
                    <Link href={`/ventas/remisiones/${r.id}`} className="text-blue-600 hover:underline">
                      {r.prefijo}{r.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-2 text-gray-800">{c?.razon_social ?? '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[r.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">{formatCOP(r.total ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
          {remisiones.length > 0 && (
            <tfoot className="border-t-2 border-gray-200">
              <tr className="font-bold">
                <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL ({resumen.total})</td>
                <td className="px-4 py-3 text-right font-mono text-purple-700">{formatCOP(resumen.total_valor)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <span>Mostrando {rangoInicio}-{rangoFin} de {total}</span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={buildHref(page - 1)} className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">Anterior</Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 text-gray-300">Anterior</span>
            )}
            <span className="px-2 font-medium">{page} / {totalPaginas}</span>
            {page < totalPaginas ? (
              <Link href={buildHref(page + 1)} className="rounded-lg border border-gray-300 px-3 py-2 hover:bg-gray-50">Siguiente</Link>
            ) : (
              <span className="rounded-lg border border-gray-200 px-3 py-2 text-gray-300">Siguiente</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
