export const dynamic = 'force-dynamic'

import { getRecibos } from '@/lib/db/ventas'
import { getSession } from '@/lib/auth/session'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string }>
}

export default async function RecibosPage({ searchParams }: PageProps) {
  const sp   = await searchParams
  const hoy  = new Date().toISOString().split('T')[0]
  const anio = new Date().getFullYear()
  const busqueda = sp.q ?? ''
  const desde = sp.desde || `${anio}-01-01`
  const hasta  = sp.hasta  || hoy

  const [session, { recibos, total }] = await Promise.all([
    getSession(),
    getRecibos({ busqueda, limit: 200, desde, hasta }),
  ])

  const totalCobrado = recibos.reduce((s, r) => s + (r.valor ?? 0), 0)
  const puedeCerrarSistecredito = session?.rol === 'admin' || session?.rol === 'contador'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
            <Receipt className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Recibos de caja</h1>
            <p className="text-sm text-gray-500">Cobros recibidos de clientes</p>
          </div>
        </div>
        {puedeCerrarSistecredito && (
          <Link
            href="/ventas/recibos/sistecredito"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Pago mensual Sistecrédito
          </Link>
        )}
      </div>

      {/* Filtros */}
      <form className={cn('flex flex-wrap gap-3', cardCls, 'p-4')}>
        <div className="flex min-w-[240px] flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={busqueda}
            placeholder="Cliente, cédula o N° recibo"
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700">Aplicar</button>
          <Link href="/ventas/recibos" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* KPI */}
      <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 w-fit">
        <p className="text-xs text-gray-500">Total cobrado en el período</p>
        <p className="text-2xl font-bold font-mono text-green-700 mt-0.5">{formatCOP(totalCobrado)}</p>
        <p className="text-xs text-gray-400 mt-0.5">{total} recibo{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabla */}
      <div className={cn(cardCls, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800/50 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Factura</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Forma de pago</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {recibos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 dark:text-gray-500">Sin recibos{busqueda ? ` para "${busqueda}"` : ' en el período'}</td></tr>
            ) : recibos.map(r => {
              const doc = r.documento as { id?: string; prefijo?: string; numero?: number } | null
              const cliente = (r.documento as { cliente?: { razon_social?: string; numero_documento?: string } } | null)?.cliente
              const fp  = r.forma_pago as { descripcion?: string } | null
              return (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => { window.location.href = `/ventas/recibos/${r.id}` }}>
                  <td className="px-4 py-3 font-mono text-gray-600 dark:text-gray-300">{r.numero}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-3">
                    {doc?.id ? (
                      <Link href={`/ventas/facturas/${doc.id}`} className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-300"
                        onClick={e => e.stopPropagation()}>
                        {doc.prefijo}{doc.numero}
                      </Link>
                    ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                    <div className="flex flex-col">
                      <span>{cliente?.razon_social ?? '—'}</span>
                      {cliente?.numero_documento && (
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{cliente.numero_documento}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fp?.descripcion ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-700 dark:text-green-300">{formatCOP(r.valor ?? 0)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
