export const dynamic = 'force-dynamic'

import { getInformeFacturas } from '@/lib/db/informes'
import { getClientes } from '@/lib/db/clientes'
import { formatCOP, formatFecha } from '@/utils/cn'
import { FileText } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; estado?: string; cliente_id?: string }>
}

const BADGE: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  pagada:    'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
  parcial:   'bg-blue-100 text-blue-700',
}

export default async function InformeFacturasPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy

  const [{ facturas, totales, total }, clientes] = await Promise.all([
    getInformeFacturas({ desde, hasta, estado: sp.estado, cliente_id: sp.cliente_id }),
    getClientes({ limit: 500 }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Informe de Facturas</h1>
          <p className="text-sm text-gray-500">{total} factura{total !== 1 ? 's' : ''} en el período</p>
        </div>
        <a href={`/api/export/ventas?desde=${desde}&hasta=${hasta}`} download
           className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          Exportar CSV
        </a>
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
          <label className="text-xs font-medium text-gray-600">Estado</label>
          <select name="estado" defaultValue={sp.estado ?? ''}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="parcial">Parcial</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Cliente</label>
          <select name="cliente_id" defaultValue={sp.cliente_id ?? ''}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs">
            <option value="">Todos</option>
            {clientes.clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razon_social}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/informes/facturas" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs totales */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Subtotal',    val: totales.subtotal },
          { label: 'Descuento',   val: totales.descuento },
          { label: 'IVA',         val: totales.iva },
          { label: 'Total',       val: totales.total,   bold: true },
          { label: 'Utilidad',    val: totales.total - totales.costo, color: 'text-green-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 font-mono ${k.color ?? (k.bold ? 'text-blue-700' : 'text-gray-900 dark:text-gray-100')}`}>{formatCOP(k.val)}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Utilidad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {facturas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin registros en el período</td></tr>
            ) : facturas.map(f => {
              const c = f.cliente as { id?: string; razon_social?: string } | null
              const utilidad = (f.total ?? 0) - (f.total_costo ?? 0)
              return (
                <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-mono text-gray-700">
                    <Link href={`/ventas/facturas/${f.id}`} className="text-blue-600 hover:underline">
                      {f.prefijo}{f.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatFecha(f.fecha)}</td>
                  <td className="px-4 py-2 text-gray-800">{c?.razon_social ?? '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE[f.estado] ?? 'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500'}`}>
                      {f.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCOP(f.total ?? 0)}</td>
                  <td className={`px-4 py-2 text-right font-mono ${utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCOP(utilidad)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
