export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { ACCOUNTING_ROLES } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha , cardCls } from '@/utils/cn'
import { RotateCcw, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string }>
}

export default async function NotasCreditoPage({ searchParams }: PageProps) {
  const sp    = await searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const desde = sp.desde || `${new Date().getFullYear()}-01-01`
  const hasta = sp.hasta || hoy
  const session = await getSession()
  const canManageNotes = !!session && (ACCOUNTING_ROLES as readonly string[]).includes(session.rol)

  const supabase = await createClient()
  const { data: notas, count } = await supabase
    .from('documentos')
      .select(`
      id, numero, prefijo, fecha, total, motivo, estado,
      cliente:cliente_id(razon_social),
      factura_origen:documento_origen_id(numero, prefijo)
    `, { count: 'exact' })
    .eq('tipo', 'nota_credito')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false })

  const totalValor = (notas ?? []).reduce((s, n) => s + (n.total ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
            <RotateCcw className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notas Crédito</h1>
            <p className="text-sm text-gray-500">{count ?? 0} nota{(count ?? 0) !== 1 ? 's' : ''} en el período</p>
          </div>
        </div>
        {canManageNotes ? (
          <Link href="/ventas/notas-credito/nueva"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors">
            <Plus className="h-4 w-4" /> Nueva nota crédito
          </Link>
        ) : null}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Notas emitidas</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Valor total devuelto</p>
          <p className="text-xl font-bold font-mono text-rose-700 mt-0.5">{formatCOP(totalValor)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className={cardCls}>
        <form className="flex gap-2 p-3 border-b border-gray-100">
          <input type="date" name="desde" defaultValue={desde}
            className="h-8 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500" />
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-8 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500" />
          <button type="submit" className="h-8 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-200">Filtrar</button>
        </form>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N° Nota</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Factura origen</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Motivo</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {(notas ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  {canManageNotes ? (
                    <>
                      No hay notas crédito en este período.{' '}
                      <Link href="/ventas/notas-credito/nueva" className="text-rose-600 hover:underline">Crear primera nota</Link>
                    </>
                  ) : (
                    'No hay notas crédito en este período.'
                  )}
                </td>
              </tr>
            ) : (notas ?? []).map(n => {
              const cliente = n.cliente as { razon_social?: string } | null
              const origen  = n.factura_origen as { numero?: number; prefijo?: string } | null
              return (
                <tr key={n.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/ventas/notas-credito/${n.id}`} className="font-mono text-rose-600 hover:underline">
                      {n.prefijo}{n.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(n.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{cliente?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {origen ? `${origen.prefijo ?? ''}${origen.numero}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate">{(n as any).motivo ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        (n as any).estado === 'cancelada'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {(n as any).estado ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-rose-700">{formatCOP(n.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
