export const dynamic = 'force-dynamic'

import { getPyG } from '@/lib/db/informes'
import { formatCOP } from '@/utils/cn'
import { TrendingUp } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function PyGPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const desde = sp.desde || `${new Date().getFullYear()}-01-01`
  const hasta  = sp.hasta  || hoy

  const { ingresos, costos, gastos, total_ingresos, total_costos, total_gastos, utilidad } =
    await getPyG({ desde, hasta })

  const margen = total_ingresos > 0 ? Math.round((utilidad / total_ingresos) * 10000) / 100 : 0

  function SeccionPyG({ titulo, cuentas, total, colorClass }: {
    titulo: string
    cuentas: { codigo: string; descripcion: string; debe: number; haber: number; naturaleza: string }[]
    total: number
    colorClass: string
  }) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <h3 className={`font-bold text-sm uppercase tracking-wide mb-3 ${colorClass}`}>{titulo}</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cuentas.map((c, i) => {
              const saldo = c.naturaleza === 'credito' ? c.haber - c.debe : c.debe - c.haber
              return (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-1.5 font-mono text-xs text-gray-500 pr-3">{c.codigo}</td>
                  <td className="py-1.5 text-gray-700 dark:text-gray-300">{c.descripcion}</td>
                  <td className="py-1.5 text-right font-mono text-gray-800 dark:text-gray-200">{formatCOP(Math.abs(saldo))}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td colSpan={2} className={`py-2 font-bold ${colorClass}`}>Total {titulo}</td>
              <td className={`py-2 text-right font-bold font-mono ${colorClass}`}>{formatCOP(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <TrendingUp className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pérdidas y Ganancias</h1>
          <p className="text-sm text-gray-500">Estado de resultados del período</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-600">Desde:</label>
        <input type="date" name="desde" defaultValue={desde}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <label className="text-sm font-medium text-gray-600">Hasta:</label>
        <input type="date" name="hasta" defaultValue={hasta}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Ver</button>
      </form>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos', val: total_ingresos, color: 'text-blue-700' },
          { label: 'Costos', val: total_costos, color: 'text-yellow-700' },
          { label: 'Gastos', val: total_gastos, color: 'text-orange-700' },
          { label: 'Utilidad neta', val: utilidad, color: utilidad >= 0 ? 'text-emerald-700' : 'text-red-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${k.color}`}>{formatCOP(k.val)}</p>
          </div>
        ))}
      </div>

      {/* Margen */}
      <div className={`rounded-xl border p-4 flex items-center justify-between ${utilidad >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div>
          <p className={`text-sm font-semibold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {utilidad >= 0 ? 'Utilidad del período' : 'Pérdida del período'}
          </p>
          <p className={`text-2xl font-bold font-mono ${utilidad >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            {formatCOP(utilidad)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Margen neto</p>
          <p className={`text-3xl font-bold ${utilidad >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{margen}%</p>
        </div>
      </div>

      {/* Detalle por sección */}
      <SeccionPyG titulo="Ingresos" cuentas={ingresos} total={total_ingresos} colorClass="text-blue-600" />
      <SeccionPyG titulo="Costos de Ventas" cuentas={costos} total={total_costos} colorClass="text-yellow-600" />
      <SeccionPyG titulo="Gastos Operacionales" cuentas={gastos} total={total_gastos} colorClass="text-orange-600" />
    </div>
  )
}
