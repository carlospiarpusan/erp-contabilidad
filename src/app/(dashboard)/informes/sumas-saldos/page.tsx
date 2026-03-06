export const dynamic = 'force-dynamic'

import { getSumasYSaldos } from '@/lib/db/informes'
import { formatCOP } from '@/utils/cn'
import { Scale } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

const TIPO_COLOR: Record<string, string> = {
  activo:     'text-green-700 bg-green-50',
  pasivo:     'text-red-700 bg-red-50',
  patrimonio: 'text-purple-700 bg-purple-50',
  ingreso:    'text-blue-700 bg-blue-50',
  gasto:      'text-orange-700 bg-orange-50',
  costo:      'text-yellow-700 bg-yellow-50',
}

export default async function SumasYSaldosPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const desde = sp.desde || `${new Date().getFullYear()}-01-01`
  const hasta  = sp.hasta  || hoy

  const cuentas = await getSumasYSaldos({ desde, hasta })

  const totalDebe  = cuentas.reduce((s, c) => s + c.debe,  0)
  const totalHaber = cuentas.reduce((s, c) => s + c.haber, 0)
  const totalSaldo = cuentas.reduce((s, c) => s + c.saldo, 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <Scale className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sumas y Saldos</h1>
          <p className="text-sm text-gray-500">Movimientos acumulados por cuenta PUC del período</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-600">Desde:</label>
        <input type="date" name="desde" defaultValue={desde}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <label className="text-sm font-medium text-gray-600">Hasta:</label>
        <input type="date" name="hasta" defaultValue={hasta}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <button type="submit" className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700">Aplicar</button>
      </form>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Total Débito</p>
          <p className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-0.5">{formatCOP(totalDebe)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Total Crédito</p>
          <p className="text-lg font-bold font-mono text-gray-900 dark:text-white mt-0.5">{formatCOP(totalHaber)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Diferencia</p>
          <p className={`text-lg font-bold font-mono mt-0.5 ${Math.abs(totalSaldo) < 1 ? 'text-emerald-600' : 'text-orange-600'}`}>
            {formatCOP(Math.abs(totalSaldo))}
            {Math.abs(totalSaldo) < 1 && <span className="text-xs ml-1 font-normal">✓ Cuadrado</span>}
          </p>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Débito</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Crédito</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {cuentas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No hay movimientos en el período</td></tr>
            ) : cuentas.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{c.codigo}</td>
                <td className="px-4 py-2 text-gray-800 dark:text-gray-200"
                  style={{ paddingLeft: `${(c.nivel - 1) * 16 + 16}px` }}>
                  {c.descripcion}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                    {c.tipo}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">{c.debe > 0 ? formatCOP(c.debe) : '—'}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-700">{c.haber > 0 ? formatCOP(c.haber) : '—'}</td>
                <td className={`px-4 py-2 text-right font-mono font-medium ${c.saldo >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                  {formatCOP(c.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-300 dark:border-gray-600">
            <tr className="font-bold bg-gray-50 dark:bg-gray-800/50">
              <td colSpan={3} className="px-4 py-3 text-gray-900 dark:text-white">TOTAL</td>
              <td className="px-4 py-3 text-right font-mono">{formatCOP(totalDebe)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatCOP(totalHaber)}</td>
              <td className={`px-4 py-3 text-right font-mono ${Math.abs(totalSaldo) < 1 ? 'text-emerald-600' : 'text-orange-600'}`}>
                {formatCOP(totalSaldo)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
