export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CreditCard, TrendingUp } from 'lucide-react'
import { getInformeVentasPorMedioPago } from '@/lib/db/informes'
import { getFormasPago } from '@/lib/db/maestros'
import { formatCOP, formatFecha } from '@/utils/cn'

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; forma_pago_id?: string }>
}

export default async function InformeVentasPorMedioPagoPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const hoy = new Date().toISOString().split('T')[0]
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const desde = sp.desde || inicioMes
  const hasta = sp.hasta || hoy
  const forma_pago_id = sp.forma_pago_id || ''

  const [{ medios, resumen, facturas }, formasPago] = await Promise.all([
    getInformeVentasPorMedioPago({ desde, hasta, forma_pago_id }),
    getFormasPago(),
  ])
  const medioPrincipal = medios[0] ?? null
  const formaSeleccionada = forma_pago_id === 'sin-forma'
    ? { descripcion: 'Sin forma de pago' }
    : formasPago.find((forma) => forma.id === forma_pago_id) ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <CreditCard className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ventas por Medio de Pago</h1>
          <p className="text-sm text-gray-500">{resumen.total_facturas} factura{resumen.total_facturas !== 1 ? 's' : ''} en el período</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={`/api/export/ventas-por-medio-pago?desde=${desde}&hasta=${hasta}${forma_pago_id ? `&forma_pago_id=${forma_pago_id}` : ''}&format=csv`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            CSV
          </a>
          <a
            href={`/api/export/ventas-por-medio-pago?desde=${desde}&hasta=${hasta}${forma_pago_id ? `&forma_pago_id=${forma_pago_id}` : ''}&format=xlsx`}
            download
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            XLSX
          </a>
        </div>
      </div>

      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input
            type="date"
            name="desde"
            defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input
            type="date"
            name="hasta"
            defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Medio de pago</label>
          <select
            name="forma_pago_id"
            defaultValue={forma_pago_id}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-56"
          >
            <option value="">Todos</option>
            <option value="sin-forma">Sin forma de pago</option>
            {formasPago.map((forma) => (
              <option key={forma.id} value={forma.id}>{forma.descripcion}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 rounded-lg bg-blue-600 px-4 text-sm text-white hover:bg-blue-700">
            Aplicar
          </button>
          <Link
            href="/informes/ventas-por-medio-pago"
            className="flex h-9 items-center rounded-lg border border-gray-300 px-4 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            Mes actual
          </Link>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500">Ventas del período</p>
          <p className="mt-0.5 font-mono text-2xl font-bold text-blue-700">{formatCOP(resumen.total_ventas)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500">Facturas</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-gray-100">{resumen.total_facturas}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-500">Ticket promedio</p>
          <p className="mt-0.5 font-mono text-2xl font-bold text-green-700">{formatCOP(resumen.ticket_promedio)}</p>
        </div>
      </div>

      {medioPrincipal && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Medio con mayor venta</p>
              <p className="text-lg font-bold text-blue-800 dark:text-blue-100">{medioPrincipal.descripcion}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {formatCOP(medioPrincipal.total)} en {medioPrincipal.facturas} factura{medioPrincipal.facturas !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Medio de pago</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Facturas</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Pagadas</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Pendientes</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Ticket prom.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Ventas</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">% Part.</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Última factura</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {medios.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  Sin ventas registradas en el período
                </td>
              </tr>
            ) : medios.map((medio) => {
              const participacion = resumen.total_ventas > 0 ? (medio.total / resumen.total_ventas) * 100 : 0
              return (
                <tr key={medio.id ?? medio.descripcion} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{medio.descripcion}</div>
                    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(participacion, 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200">{medio.facturas}</td>
                  <td className="px-4 py-3 text-right text-green-700">{medio.pagadas}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{medio.pendientes}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-200">{formatCOP(medio.ticket_promedio)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{formatCOP(medio.total)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-600">{participacion.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-gray-500">{medio.ultima_fecha ? formatFecha(medio.ultima_fecha) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {formaSeleccionada && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Facturas de {formaSeleccionada.descripcion}
              </h2>
              <p className="text-xs text-gray-500">
                {facturas.length} factura{facturas.length !== 1 ? 's' : ''} en el período filtrado
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {facturas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Sin facturas para {formaSeleccionada.descripcion} en ese rango
                  </td>
                </tr>
              ) : facturas.map((factura) => {
                const cliente = factura.cliente as { razon_social?: string } | null
                return (
                  <tr key={factura.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-gray-700">
                      <Link href={`/ventas/facturas/${factura.id}`} className="text-blue-600 hover:underline">
                        {factura.prefijo}{factura.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatFecha(factura.fecha)}</td>
                    <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{cliente?.razon_social ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        factura.estado === 'pagada'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {factura.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">
                      {formatCOP(factura.total)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
