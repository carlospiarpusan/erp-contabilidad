export const dynamic = 'force-dynamic'

import { getBalanceSituacion } from '@/lib/db/informes'
import { formatCOP } from '@/utils/cn'
import { Landmark } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ fecha?: string }>
}

function SeccionBalance({ titulo, cuentas, total, colorTotal }: {
  titulo: string
  cuentas: { codigo: string; descripcion: string; nivel: number; naturaleza: string; debe: number; haber: number }[]
  total: number
  colorTotal: string
}) {
  return (
    <div>
      <h3 className="font-bold text-gray-800 dark:text-white text-base mb-3 uppercase tracking-wide">{titulo}</h3>
      <table className="w-full text-sm mb-2">
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {cuentas.map((c, i) => {
            const saldo = c.naturaleza === 'debito' ? c.debe - c.haber : c.haber - c.debe
            return (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="py-1.5 font-mono text-xs text-gray-500">{c.codigo}</td>
                <td className="py-1.5 text-gray-700 dark:text-gray-300"
                  style={{ paddingLeft: `${(c.nivel - 1) * 12}px` }}>
                  {c.descripcion}
                </td>
                <td className="py-1.5 text-right font-mono font-medium text-gray-800 dark:text-gray-200">
                  {formatCOP(Math.abs(saldo))}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-400">
            <td colSpan={2} className={`py-2 font-bold ${colorTotal}`}>Total {titulo}</td>
            <td className={`py-2 text-right font-bold font-mono ${colorTotal}`}>{formatCOP(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default async function BalanceSituacionPage({ searchParams }: PageProps) {
  const sp          = await searchParams
  const fecha_corte = sp.fecha || new Date().toISOString().split('T')[0]

  const { activos, total_activos, pasivos, total_pasivos, patrimonio, total_patrimonio } =
    await getBalanceSituacion({ fecha_corte })

  const ecuacion_ok = Math.abs(total_activos - (total_pasivos + total_patrimonio)) < 1

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <Landmark className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Balance de Situación</h1>
          <p className="text-sm text-gray-500">Estado patrimonial al corte de fecha</p>
        </div>
      </div>

      {/* Selector de fecha */}
      <form className="flex gap-3 items-center">
        <label className="text-sm font-medium text-gray-600">Fecha de corte:</label>
        <input type="date" name="fecha" defaultValue={fecha_corte}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <button type="submit" className="h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">Ver</button>
      </form>

      {/* Ecuación contable */}
      <div className={`rounded-xl border p-4 text-sm font-medium flex items-center justify-between ${ecuacion_ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-orange-200 bg-orange-50 text-orange-700'}`}>
        <span>Activos ({formatCOP(total_activos)}) = Pasivos ({formatCOP(total_pasivos)}) + Patrimonio ({formatCOP(total_patrimonio)})</span>
        <span>{ecuacion_ok ? '✓ Cuadrado' : '⚠ Descuadrado'}</span>
      </div>

      {/* Balance en dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <SeccionBalance titulo="Activos" cuentas={activos} total={total_activos} colorTotal="text-green-700" />
        </div>
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
            <SeccionBalance titulo="Pasivos" cuentas={pasivos} total={total_pasivos} colorTotal="text-red-700" />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
            <SeccionBalance titulo="Patrimonio" cuentas={patrimonio} total={total_patrimonio} colorTotal="text-purple-700" />
          </div>
        </div>
      </div>
    </div>
  )
}
