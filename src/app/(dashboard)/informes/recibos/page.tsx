export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { CreditCard } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; tipo?: string }>
}

export default async function InformeRecibosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const hoy  = new Date().toISOString().split('T')[0]
  const anio = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy
  const tipo   = sp.tipo || ''

  const supabase = await createClient()
  let q = supabase
    .from('recibos')
    .select('id, numero, tipo, fecha, valor, observaciones, cliente:cliente_id(razon_social), forma_pago:forma_pago_id(descripcion)', { count: 'exact' })
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (tipo) q = q.eq('tipo', tipo)

  const { data, count, error } = await q
  if (error) console.error(error)

  const recibos = data ?? []
  const totalValor = recibos.reduce((s, r) => s + (r.valor ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <CreditCard className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Informe de Recibos</h1>
          <p className="text-sm text-gray-500">{count ?? 0} recibo{(count ?? 0) !== 1 ? 's' : ''} en el período</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
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
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select name="tipo" defaultValue={tipo}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="venta">Cobros de venta</option>
            <option value="compra">Pagos de compra</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/informes/recibos" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* Total */}
      <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 w-fit">
        <p className="text-xs text-gray-500">Total recibido/pagado</p>
        <p className="text-2xl font-bold font-mono text-green-700 mt-0.5">{formatCOP(totalValor)}</p>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente/Pago</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Forma de pago</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recibos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin recibos en el período</td></tr>
            ) : recibos.map(r => {
              const c  = r.cliente as { razon_social?: string } | null
              const fp = r.forma_pago as { descripcion?: string } | null
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono text-gray-600">{r.numero}</td>
                  <td className="px-4 py-2 text-gray-600">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.tipo === 'venta' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {r.tipo === 'venta' ? 'Cobro' : 'Pago'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-800">{c?.razon_social ?? r.observaciones ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{fp?.descripcion ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-green-700">{formatCOP(r.valor ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
