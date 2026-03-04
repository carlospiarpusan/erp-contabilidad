export const dynamic = 'force-dynamic'

import { getInformeBalances } from '@/lib/db/informes'
import { formatCOP } from '@/utils/cn'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ anio?: string }>
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function InformeBalancesPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const anio  = sp.anio ? parseInt(sp.anio) : new Date().getFullYear()
  const { meses, totales, por_cobrar } = await getInformeBalances({ anio })

  const maxVal = Math.max(...meses.map(m => Math.max(m.ventas, m.compras, m.gastos)), 1)

  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <BarChart3 className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Balance General</h1>
          <p className="text-sm text-gray-500">Ventas, compras, gastos y utilidad — año {anio}</p>
        </div>
      </div>

      {/* Selector año */}
      <form className="flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-600">Año:</label>
        <select name="anio" defaultValue={anio}
          onChange={undefined}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Ver</button>
      </form>

      {/* KPIs anuales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Ventas año',   val: totales.ventas,   color: 'text-blue-700' },
          { label: 'Compras año',  val: totales.compras,  color: 'text-orange-700' },
          { label: 'Gastos año',   val: totales.gastos,   color: 'text-red-700' },
          { label: 'Cobrado año',  val: totales.cobrado,  color: 'text-green-700' },
          { label: 'Utilidad',     val: totales.utilidad, color: totales.utilidad >= 0 ? 'text-emerald-700' : 'text-red-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 font-mono ${k.color}`}>{formatCOP(k.val)}</p>
          </div>
        ))}
      </div>

      {por_cobrar > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 flex items-center justify-between">
          <p className="text-sm text-orange-700 font-medium">Cartera pendiente de cobro</p>
          <p className="font-mono font-bold text-orange-800 text-lg">{formatCOP(por_cobrar)}</p>
        </div>
      )}

      {/* Gráfico de barras mensual */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Evolución mensual {anio}</h3>
        <div className="flex items-end gap-2 h-48">
          {meses.map(m => (
            <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-end gap-0.5 w-full" style={{ height: '160px' }}>
                {/* Ventas */}
                <div
                  title={`Ventas: ${formatCOP(m.ventas)}`}
                  className="flex-1 bg-blue-500 rounded-t-sm min-h-[1px] transition-all"
                  style={{ height: `${Math.round((m.ventas / maxVal) * 100)}%` }}
                />
                {/* Compras */}
                <div
                  title={`Compras: ${formatCOP(m.compras)}`}
                  className="flex-1 bg-orange-400 rounded-t-sm min-h-[1px] transition-all"
                  style={{ height: `${Math.round((m.compras / maxVal) * 100)}%` }}
                />
                {/* Gastos */}
                <div
                  title={`Gastos: ${formatCOP(m.gastos)}`}
                  className="flex-1 bg-red-400 rounded-t-sm min-h-[1px] transition-all"
                  style={{ height: `${Math.round((m.gastos / maxVal) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-400">{m.nombre}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />Ventas</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />Compras</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Gastos</span>
        </div>
      </div>

      {/* Tabla mensual */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Mes</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Ventas</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Cobrado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Compras</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Gastos</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Utilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meses.map(m => (
              <tr key={m.mes} className={`hover:bg-gray-50 ${m.ventas === 0 && m.compras === 0 ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-700">{m.nombre} {anio}</td>
                <td className="px-4 py-2 text-right font-mono text-blue-700">{formatCOP(m.ventas)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-700">{formatCOP(m.cobrado)}</td>
                <td className="px-4 py-2 text-right font-mono text-orange-700">{formatCOP(m.compras)}</td>
                <td className="px-4 py-2 text-right font-mono text-red-600">{formatCOP(m.gastos)}</td>
                <td className={`px-4 py-2 text-right font-mono font-semibold ${m.utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCOP(m.utilidad)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-800">
            <tr className="font-bold">
              <td className="px-4 py-3 text-gray-900">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono text-blue-700">{formatCOP(totales.ventas)}</td>
              <td className="px-4 py-3 text-right font-mono text-green-700">{formatCOP(totales.cobrado)}</td>
              <td className="px-4 py-3 text-right font-mono text-orange-700">{formatCOP(totales.compras)}</td>
              <td className="px-4 py-3 text-right font-mono text-red-600">{formatCOP(totales.gastos)}</td>
              <td className={`px-4 py-3 text-right font-mono ${totales.utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCOP(totales.utilidad)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
