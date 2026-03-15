export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { formatCOP , cardCls , cn } from '@/utils/cn'
import Link from 'next/link'
import { ChevronLeft, Users } from 'lucide-react'

interface PageProps { searchParams: Promise<{ mes?: string; anio?: string }> }

export default async function ComisionesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const hoy = new Date()
  const mes = parseInt(params.mes ?? String(hoy.getMonth() + 1))
  const anio = parseInt(params.anio ?? String(hoy.getFullYear()))

  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10) // último día del mes

  const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

  // Facturas de venta del mes por colaborador
  const { data: facturas } = await supabase
    .from('documentos')
    .select('id, total, colaborador_id, colaborador:colaboradores(id, nombre, porcentaje_comision, meta_mensual)')
    .eq('empresa_id', empresa_id)
    .eq('tipo', 'factura_venta')
    .neq('estado', 'cancelada')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .not('colaborador_id', 'is', null)

  // Agrupar por colaborador
  const porColaborador: Record<string, {
    id: string; nombre: string
    porcentaje_comision: number; meta_mensual: number
    total_ventas: number; comision: number; facturas: number
  }> = {}

  for (const f of facturas ?? []) {
    const col = (f.colaborador as any)
    if (!col) continue
    if (!porColaborador[col.id]) {
      porColaborador[col.id] = {
        id: col.id,
        nombre: col.nombre,
        porcentaje_comision: col.porcentaje_comision ?? 0,
        meta_mensual: col.meta_mensual ?? 0,
        total_ventas: 0,
        comision: 0,
        facturas: 0,
      }
    }
    porColaborador[col.id].total_ventas += f.total
    porColaborador[col.id].facturas += 1
  }

  const resumen = Object.values(porColaborador).map(c => ({
    ...c,
    comision: c.total_ventas * (c.porcentaje_comision / 100),
    pct_meta: c.meta_mensual > 0 ? Math.min(100, (c.total_ventas / c.meta_mensual) * 100) : null,
  })).sort((a, b) => b.total_ventas - a.total_ventas)

  const totalVentas = resumen.reduce((s, c) => s + c.total_ventas, 0)
  const totalComisiones = resumen.reduce((s, c) => s + c.comision, 0)

  // Opciones de mes/año
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/informes/balances" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Informes
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Comisiones</h1>
            <p className="text-sm text-gray-500">{meses[mes - 1]} {anio}</p>
          </div>
        </div>

        {/* Filtro mes/año */}
        <form className="flex gap-2 items-center">
          <select name="mes" defaultValue={mes} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-700">
            {meses.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select name="anio" defaultValue={anio} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-700">
            {[anio - 1, anio, anio + 1].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">Ver</button>
        </form>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total ventas', value: formatCOP(totalVentas), color: 'text-blue-700' },
          { label: 'Total comisiones', value: formatCOP(totalComisiones), color: 'text-purple-700' },
          { label: 'Colaboradores activos', value: String(resumen.length), color: 'text-gray-900 dark:text-white' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`font-bold text-lg mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {resumen.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Sin ventas con colaborador asignado en este período</p>
      ) : (
        <div className={cn(cardCls, 'overflow-hidden')}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Colaborador</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Facturas</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Ventas</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">% Meta</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Comisión ({'{%}'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {resumen.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-200 text-sm">{c.nombre}</p>
                    {c.meta_mensual > 0 && <p className="text-xs text-gray-400">Meta: {formatCOP(c.meta_mensual)}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{c.facturas}</td>
                  <td className="px-4 py-3 text-right text-sm font-mono font-medium text-gray-800 dark:text-gray-200">{formatCOP(c.total_ventas)}</td>
                  <td className="px-4 py-3">
                    {c.pct_meta !== null ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-gray-600">{c.pct_meta.toFixed(0)}%</span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.pct_meta >= 100 ? 'bg-green-500' : c.pct_meta >= 70 ? 'bg-blue-500' : 'bg-orange-400'}`}
                            style={{ width: `${c.pct_meta}%` }}
                          />
                        </div>
                      </div>
                    ) : <span className="text-xs text-gray-400 block text-center">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold text-sm text-purple-600">{formatCOP(c.comision)}</span>
                    <span className="text-xs text-gray-400 ml-1">({c.porcentaje_comision}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Total</td>
                <td className="px-4 py-3 text-right text-sm font-bold font-mono text-gray-800 dark:text-white">{formatCOP(totalVentas)}</td>
                <td />
                <td className="px-4 py-3 text-right text-sm font-bold text-purple-700">{formatCOP(totalComisiones)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
