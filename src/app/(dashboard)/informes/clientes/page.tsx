export const dynamic = 'force-dynamic'

import { getInformeClientes } from '@/lib/db/informes'
import { formatCOP , cardCls , cn } from '@/utils/cn'
import { Users } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function InformeClientesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const hoy  = new Date().toISOString().split('T')[0]
  const anio = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy

  const clientes = await getInformeClientes({ desde, hasta })

  const totales = clientes.reduce((acc, c) => ({
    facturado:  acc.facturado  + c.facturado,
    cobrado:    acc.cobrado    + c.cobrado,
    por_cobrar: acc.por_cobrar + c.por_cobrar,
    utilidad:   acc.utilidad   + c.utilidad,
  }), { facturado: 0, cobrado: 0, por_cobrar: 0, utilidad: 0 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <Users className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cartera de Clientes</h1>
          <p className="text-sm text-gray-500">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} con movimiento</p>
        </div>
      </div>

      {/* Filtros */}
      <form className={cn('flex flex-wrap gap-3', cardCls, 'p-4')}>
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
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/informes/clientes" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total facturado', val: totales.facturado, color: 'text-blue-700' },
          { label: 'Total cobrado',   val: totales.cobrado,   color: 'text-green-700' },
          { label: 'Por cobrar',      val: totales.por_cobrar, color: 'text-orange-700' },
          { label: 'Utilidad bruta',  val: totales.utilidad,  color: 'text-emerald-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 font-mono ${k.color}`}>{formatCOP(k.val)}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className={cn(cardCls, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Documento</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Facturas</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Facturado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Cobrado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Por cobrar</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Utilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin movimiento en el período</td></tr>
            ) : clientes.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2 font-medium text-gray-900">
                  <Link href={`/clientes/${c.id}`} className="text-blue-600 hover:underline">{c.razon_social}</Link>
                </td>
                <td className="px-4 py-2 text-gray-500 font-mono text-xs">{c.numero_documento}</td>
                <td className="px-4 py-2 text-right text-gray-600">{c.num_facturas}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCOP(c.facturado)}</td>
                <td className="px-4 py-2 text-right font-mono text-green-700">{formatCOP(c.cobrado)}</td>
                <td className={`px-4 py-2 text-right font-mono ${c.por_cobrar > 0 ? 'text-orange-700 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>{formatCOP(c.por_cobrar)}</td>
                <td className={`px-4 py-2 text-right font-mono ${c.utilidad >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCOP(c.utilidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
