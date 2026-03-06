export const dynamic = 'force-dynamic'

import { getLibroMayor } from '@/lib/db/informes'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { BookOpen } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ cuenta_id?: string; desde?: string; hasta?: string }>
}

export default async function LibroMayorPage({ searchParams }: PageProps) {
  const sp        = await searchParams
  const hoy       = new Date().toISOString().split('T')[0]
  const cuenta_id = sp.cuenta_id || ''
  const desde     = sp.desde || `${new Date().getFullYear()}-01-01`
  const hasta     = sp.hasta || hoy

  const supabase = await createClient()
  const { data: cuentas } = await supabase
    .from('cuentas_puc')
    .select('id, codigo, descripcion, nivel')
    .eq('activa', true)
    .gte('nivel', 3)  // Solo cuentas y subcuentas (no clases ni grupos)
    .order('codigo')

  let resultado: Awaited<ReturnType<typeof getLibroMayor>> | null = null
  if (cuenta_id) {
    resultado = await getLibroMayor({ cuenta_id, desde, hasta })
  }

  const totalDebe  = resultado?.movimientos.reduce((s, m) => s + m.debe,  0) ?? 0
  const totalHaber = resultado?.movimientos.reduce((s, m) => s + m.haber, 0) ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <BookOpen className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Libro Mayor</h1>
          <p className="text-sm text-gray-500">Movimientos cronológicos por cuenta PUC</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 items-center">
        <select name="cuenta_id" defaultValue={cuenta_id}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 min-w-64">
          <option value="">— Seleccionar cuenta —</option>
          {(cuentas ?? []).map(c => (
            <option key={c.id} value={c.id}>
              {c.codigo} — {c.descripcion}
            </option>
          ))}
        </select>
        <input type="date" name="desde" defaultValue={desde}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        <input type="date" name="hasta" defaultValue={hasta}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500" />
        <button type="submit" className="h-9 px-4 rounded-lg bg-slate-600 text-white text-sm hover:bg-slate-700">Ver</button>
      </form>

      {!cuenta_id && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 px-6 py-10 text-center text-gray-400">
          Selecciona una cuenta PUC para ver sus movimientos
        </div>
      )}

      {resultado && (
        <>
          {/* Info cuenta */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30 px-5 py-3">
            <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {resultado.cuenta?.codigo} — {resultado.cuenta?.descripcion}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Naturaleza: {resultado.cuenta?.naturaleza === 'debito' ? 'Débito' : 'Crédito'} ·
              {resultado.movimientos.length} movimiento{resultado.movimientos.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Tabla movimientos */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">N° Asiento</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Concepto</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Débito</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Crédito</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {resultado.movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                      No hay movimientos para esta cuenta en el período
                    </td>
                  </tr>
                ) : resultado.movimientos.map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{formatFecha(m.fecha)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{m.numero}</td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-64 truncate">{m.concepto}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{m.debe > 0 ? formatCOP(m.debe) : '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-700">{m.haber > 0 ? formatCOP(m.haber) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-mono font-medium ${m.saldo >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600'}`}>
                      {formatCOP(m.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-300 dark:border-gray-600">
                <tr className="font-bold bg-gray-50 dark:bg-gray-800/50">
                  <td colSpan={3} className="px-4 py-3 text-gray-900 dark:text-white">TOTAL</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCOP(totalDebe)}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCOP(totalHaber)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${resultado.movimientos.at(-1)?.saldo ?? 0 >= 0 ? '' : 'text-red-600'}`}>
                    {formatCOP(resultado.movimientos.at(-1)?.saldo ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
