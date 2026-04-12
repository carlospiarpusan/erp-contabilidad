export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCOP } from '@/utils/cn'
import {
  TrendingUp, ShoppingCart, Receipt, DollarSign,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Clock,
  Users, Percent, Lightbulb, Plus, FileText, Truck,
} from 'lucide-react'
import {
  getKPIsDashboard, getResumenMensual,
  getUltimasFacturas, getUltimasCompras,
  getAlertasSinRotacion, getAlertasStock, getFacturasVencidas, getTopClientes,
} from '@/lib/db/dashboard'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

async function cargarDatos() {
  try {
    const [kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, alertasSinRotacion, facturasVencidas, topClientes] =
      await Promise.all([
        getKPIsDashboard(),
        getResumenMensual(),
        getUltimasFacturas(6),
        getUltimasCompras(4),
        getAlertasStock(),
        getAlertasSinRotacion(10),
        getFacturasVencidas(),
        getTopClientes(),
      ])
    return { kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, alertasSinRotacion, facturasVencidas, topClientes }
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const session = await getSession()
  if (session?.rol === 'superadmin') redirect('/superadmin')

  const datos = await cargarDatos()
  if (!datos) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Cargando datos...</p>
      </div>
    )
  }

  const { kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, alertasSinRotacion, facturasVencidas, topClientes } = datos
  const mesActual = new Date().getMonth()
  const resumenFiltrado = resumen.filter(m => m.mes <= mesActual + 1)
  const maxVal = Math.max(...resumenFiltrado.flatMap(m => [m.ventas, m.compras, m.gastos]), 1)
  const puedeVerSugeridos = session ? ['admin', 'contador'].includes(session.rol) : false
  const totalAlertas = alertasStock.length + alertasSinRotacion.length + facturasVencidas.length

  return (
    <div className="flex flex-col gap-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Resumen General</h2>
          <p className="text-sm text-gray-400 mt-0.5">Ejercicio {new Date().getFullYear()} · {MESES[mesActual]}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ventas/facturas/nueva"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold px-3.5 py-2 hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20">
            <Plus className="h-3.5 w-3.5" /> Nueva venta
          </Link>
          <Link href="/pos"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold px-3.5 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm">
            <ShoppingCart className="h-3.5 w-3.5" /> POS
          </Link>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Facturado', value: formatCOP(kpis.facturado_anio), icon: TrendingUp, gradient: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400', href: '/ventas/facturas' },
          { label: 'Por cobrar', value: formatCOP(kpis.por_cobrar), icon: ArrowUpRight, gradient: 'from-amber-500 to-amber-600', text: 'text-amber-600 dark:text-amber-400', href: '/ventas/facturas' },
          { label: 'Por pagar', value: formatCOP(kpis.por_pagar), icon: ArrowDownRight, gradient: 'from-rose-500 to-rose-600', text: 'text-rose-600 dark:text-rose-400', href: '/compras/facturas' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 group hover:shadow-md hover:shadow-gray-100/50 dark:hover:shadow-none transition-all">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${k.gradient} shadow-sm mb-3`}>
              <k.icon className="h-4 w-4 text-white" />
            </div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{k.label}</p>
            {k.href ? (
              <Link href={k.href} className={`font-bold text-gray-900 dark:text-gray-100 text-sm block group-hover:${k.text} transition-colors`}>{k.value}</Link>
            ) : (
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{k.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Ventas este mes', value: formatCOP(kpis.ventas_mes), icon: FileText, color: 'from-teal-500 to-teal-600', href: '/ventas/facturas' },
          { label: 'Cobrado este mes', value: formatCOP(kpis.cobrado_mes), icon: DollarSign, color: 'from-emerald-500 to-emerald-600', href: '/ventas/recibos' },
          { label: 'Gastos este mes', value: formatCOP(kpis.gastos_mes), icon: Receipt, color: 'from-rose-500 to-rose-600', href: '/gastos' },
        ].map(k => (
          <Link key={k.label} href={k.href}
            className="rounded-xl bg-white border border-gray-100 p-4 flex items-center gap-3.5 hover:shadow-md hover:shadow-gray-100/50 transition-all dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none group">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${k.color} shrink-0 shadow-sm`}>
              <k.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-[15px] mt-0.5">{k.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Main body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Chart */}
        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Ventas vs Compras vs Gastos</h3>
            <span className="text-[11px] font-medium text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-md">{new Date().getFullYear()}</span>
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {resumenFiltrado.map(m => (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '120px' }}>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-teal-600 to-teal-400 min-h-[2px] transition-all"
                    style={{ height: `${Math.round((m.ventas / maxVal) * 110)}px` }}
                    title={`Ventas: ${formatCOP(m.ventas)}`}
                  />
                </div>
                <div className="w-full flex gap-0.5">
                  <div className="flex-1 rounded bg-amber-400" style={{ height: `${Math.max(Math.round((m.compras / maxVal) * 30), 2)}px` }} title={`Compras: ${formatCOP(m.compras)}`} />
                  <div className="flex-1 rounded bg-rose-400" style={{ height: `${Math.max(Math.round((m.gastos / maxVal) * 30), 2)}px` }} title={`Gastos: ${formatCOP(m.gastos)}`} />
                </div>
                <span className="text-[10px] font-medium text-gray-400">{MESES[m.mes - 1]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-800 flex gap-5 text-[11px] font-medium text-gray-400">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />Ventas</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Compras</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Gastos</span>
          </div>
        </div>

        {/* Alerts + Top clients */}
        <div className="flex flex-col gap-4">
          {/* Alerts */}
          <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              </div>
              Alertas
              {totalAlertas > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold px-1">{totalAlertas}</span>
              )}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              {alertasStock.length > 0 && (
                <Link href="/productos/stock-bajo" className="rounded-lg bg-orange-50 dark:bg-orange-900/10 p-3 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors border border-orange-100 dark:border-orange-900/20">
                  <p className="font-semibold text-orange-700 dark:text-orange-400 text-[13px]">Stock bajo</p>
                  <p className="text-[11px] text-orange-600/70 dark:text-orange-500 mt-0.5">{alertasStock.length} producto{alertasStock.length !== 1 ? 's' : ''} bajo mínimo</p>
                </Link>
              )}
              {alertasStock.length > 0 && puedeVerSugeridos && (
                <Link href="/compras/sugeridos" className="rounded-lg bg-blue-50 dark:bg-blue-900/10 p-3 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors border border-blue-100 dark:border-blue-900/20">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 text-[13px] flex items-center gap-1">
                    <Lightbulb className="h-3.5 w-3.5" /> Sugeridos de compra
                  </p>
                  <p className="text-[11px] text-blue-600/70 dark:text-blue-500 mt-0.5">Pedido recomendado por rotación y stock</p>
                </Link>
              )}
              {alertasSinRotacion.length > 0 && (
                <Link href="/productos/sin-rotacion" className="rounded-lg bg-violet-50 dark:bg-violet-900/10 p-3 hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-colors border border-violet-100 dark:border-violet-900/20">
                  <p className="font-semibold text-violet-700 dark:text-violet-400 text-[13px]">Sin rotación</p>
                  <p className="text-[11px] text-violet-700/70 dark:text-violet-500 mt-0.5">
                    {alertasSinRotacion.length} producto{alertasSinRotacion.length !== 1 ? 's' : ''} con stock sin ventas recientes
                  </p>
                </Link>
              )}
              {facturasVencidas.length > 0 && (
                <Link href="/ventas/facturas" className="rounded-lg bg-red-50 dark:bg-red-900/10 p-3 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors border border-red-100 dark:border-red-900/20">
                  <p className="font-semibold text-red-700 dark:text-red-400 text-[13px] flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Facturas vencidas
                  </p>
                  <p className="text-[11px] text-red-600/70 dark:text-red-500 mt-0.5">{facturasVencidas.length} factura{facturasVencidas.length !== 1 ? 's' : ''} sin pagar</p>
                </Link>
              )}
              {kpis.por_pagar > 0 && (
                <Link href="/compras/facturas" className="rounded-lg bg-yellow-50 dark:bg-yellow-900/10 p-3 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors border border-yellow-100 dark:border-yellow-900/20">
                  <p className="font-semibold text-yellow-700 dark:text-yellow-400 text-[13px]">Compras pendientes</p>
                  <p className="text-[11px] text-yellow-700/70 dark:text-yellow-500 mt-0.5">{formatCOP(kpis.por_pagar)} por pagar</p>
                </Link>
              )}
              {totalAlertas === 0 && kpis.por_pagar === 0 && (
                <div className="text-center py-4">
                  <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-xs text-gray-400">Sin alertas pendientes</p>
                </div>
              )}
            </div>
          </div>

          {/* Top clients */}
          {topClientes.length > 0 && (
            <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                </div>
                Top clientes
              </h3>
              <div className="flex flex-col gap-2.5">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-50 dark:bg-gray-800 text-[10px] font-bold text-gray-400">{i + 1}</span>
                    <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate flex-1">{c.razon_social}</span>
                    <span className="font-mono text-[11px] font-bold text-gray-800 dark:text-gray-200 shrink-0">{formatCOP(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent sales */}
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Últimas ventas</h3>
            <Link href="/ventas/facturas" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">Ver todas</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {(ultimasFacturas as Record<string, unknown>[]).map((f) => (
                <tr key={f.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/ventas/facturas/${f.id}`} className="font-mono text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400">
                      {f.prefijo as string}{f.numero as number}
                    </Link>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 truncate max-w-32 text-[13px]">
                    {(f.cliente as { razon_social?: string } | null)?.razon_social ?? '—'}
                  </td>
                  <td className="py-3 text-right font-mono text-xs font-bold text-gray-800 dark:text-gray-200">{formatCOP(f.total as number)}</td>
                  <td className="py-3 px-5 text-right">
                    <Badge variant={f.estado === 'pagada' ? 'success' : 'warning'}>
                      {f.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {ultimasFacturas.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-gray-400">Sin facturas aún</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent purchases */}
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Últimas compras</h3>
            <Link href="/compras/facturas" className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400">Ver todas</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {(ultimasCompras as Record<string, unknown>[]).map((c) => (
                <tr key={c.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/compras/facturas/${c.id}`} className="font-mono text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">
                      {c.prefijo as string}{c.numero as number}
                    </Link>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 truncate max-w-32 text-[13px]">
                    {(c.proveedor as { razon_social?: string } | null)?.razon_social ?? '—'}
                  </td>
                  <td className="py-3 text-right font-mono text-xs font-bold text-gray-800 dark:text-gray-200">{formatCOP(c.total as number)}</td>
                  <td className="py-3 px-5 text-right">
                    <Badge variant={c.estado === 'pagada' ? 'success' : 'warning'}>
                      {c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {ultimasCompras.length === 0 && (
                <tr><td colSpan={4} className="py-8 text-center text-xs text-gray-400">Sin compras aún</td></tr>
              )}
            </tbody>
          </table>
          {/* Quick actions */}
          <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20 flex gap-2">
            <Link href="/ventas/facturas/nueva"
              className="flex-1 text-center rounded-lg bg-teal-600 text-white text-[11px] py-2 font-semibold hover:bg-teal-700 transition-colors shadow-sm shadow-teal-600/20">
              + Nueva venta
            </Link>
            <Link href="/compras/facturas/nueva"
              className="flex-1 text-center rounded-lg bg-amber-600 text-white text-[11px] py-2 font-semibold hover:bg-amber-700 transition-colors shadow-sm shadow-amber-600/20">
              + Nueva compra
            </Link>
            <Link href="/gastos/nuevo"
              className="flex-1 text-center rounded-lg bg-rose-600 text-white text-[11px] py-2 font-semibold hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/20">
              + Gasto
            </Link>
            {puedeVerSugeridos && (
              <Link href="/compras/sugeridos"
                className="flex-1 text-center rounded-lg bg-violet-600 text-white text-[11px] py-2 font-semibold hover:bg-violet-700 transition-colors shadow-sm shadow-violet-600/20 flex items-center justify-center gap-1">
                <Lightbulb className="h-3 w-3" /> Sugeridos
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
