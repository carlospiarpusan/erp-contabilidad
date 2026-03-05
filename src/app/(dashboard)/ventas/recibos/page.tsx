export const dynamic = 'force-dynamic'

import { getRecibos } from '@/lib/db/ventas'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function RecibosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const hoy  = new Date().toISOString().split('T')[0]
  const anio = new Date().getFullYear()
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy

  const { recibos, total } = await getRecibos({ limit: 200, desde, hasta })

  const totalCobrado = recibos.reduce((s, r) => s + (r.valor ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <Receipt className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recibos de caja</h1>
          <p className="text-sm text-gray-500">Cobros recibidos de clientes</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Aplicar</button>
          <Link href="/ventas/recibos" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* KPI */}
      <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 w-fit">
        <p className="text-xs text-gray-500">Total cobrado en el período</p>
        <p className="text-2xl font-bold font-mono text-green-700 mt-0.5">{formatCOP(totalCobrado)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{total} recibo{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Factura</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Forma de pago</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recibos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin recibos en el período</td></tr>
            ) : recibos.map(r => {
              const doc = r.documento as { id?: string; prefijo?: string; numero?: number } | null
              const cliente = (r.documento as { cliente?: { razon_social?: string } } | null)?.cliente
              const fp  = r.forma_pago as { descripcion?: string } | null
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => { window.location.href = `/ventas/recibos/${r.id}` }}>
                  <td className="px-4 py-3 font-mono text-gray-600">{r.numero}</td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-3">
                    {doc?.id ? (
                      <Link href={`/ventas/facturas/${doc.id}`} className="text-blue-600 hover:underline font-mono text-xs"
                        onClick={e => e.stopPropagation()}>
                        {doc.prefijo}{doc.numero}
                      </Link>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{cliente?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{fp?.descripcion ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{formatCOP(r.valor ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
