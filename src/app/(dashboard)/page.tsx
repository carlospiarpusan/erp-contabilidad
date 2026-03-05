export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatCOP } from '@/utils/cn'
import {
  TrendingUp, ShoppingCart, Receipt, DollarSign,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Clock,
  Users, Percent,
} from 'lucide-react'
import {
  getKPIsDashboard, getResumenMensual,
  getUltimasFacturas, getUltimasCompras,
  getAlertasStock, getFacturasVencidas, getTopClientes,
} from '@/lib/db/dashboard'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

async function cargarDatos() {
  try {
    const [kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, facturasVencidas, topClientes] =
      await Promise.all([
        getKPIsDashboard(),
        getResumenMensual(),
        getUltimasFacturas(6),
        getUltimasCompras(4),
        getAlertasStock(),
        getFacturasVencidas(),
        getTopClientes(),
      ])
    return { kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, facturasVencidas, topClientes }
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
        <p className="text-gray-400">Cargando datos…</p>
      </div>
    )
  }

  const { kpis, resumen, ultimasFacturas, ultimasCompras, alertasStock, facturasVencidas, topClientes } = datos
  const mesActual = new Date().getMonth() // 0-based
  const resumenFiltrado = resumen.filter(m => m.mes <= mesActual + 1)
  const maxVal = Math.max(...resumenFiltrado.flatMap(m => [m.ventas, m.compras, m.gastos]), 1)

  const totalAlertas = alertasStock.length + facturasVencidas.length

  return (
    <div className="flex flex-col gap-6">
      {/* Título */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Resumen General</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Ejercicio {new Date().getFullYear()} · {MESES[mesActual]}</p>
      </div>

      {/* ── KPIs fila 1: año ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Facturado año', value: formatCOP(kpis.facturado_anio), icon: TrendingUp, color: 'bg-blue-50   text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', href: '/ventas/facturas' },
          { label: 'Ganancia año', value: formatCOP(kpis.ganancias_anio), icon: DollarSign, color: 'bg-green-50  text-green-600 dark:bg-green-900/30 dark:text-green-400', href: '/ventas/facturas' },
          { label: 'Margen', value: `${kpis.margen}%`, icon: Percent, color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', href: null },
          { label: 'Por cobrar', value: formatCOP(kpis.por_cobrar), icon: ArrowUpRight, color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', href: '/ventas/facturas' },
          { label: 'Por pagar', value: formatCOP(kpis.por_pagar), icon: ArrowDownRight, color: 'bg-red-50  text-red-600 dark:bg-red-900/30 dark:text-red-400', href: '/compras/facturas' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${k.color} mb-3`}>
              <k.icon className="h-4 w-4" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{k.label}</p>
            {k.href ? (
              <Link href={k.href} className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 text-sm block">{k.value}</Link>
            ) : (
              <p className="font-bold text-gray-900 dark:text-white text-sm">{k.value}</p>
            )}
          </div>
        ))}
      </div>

      {/* ── KPIs fila 2: este mes ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ventas este mes', value: formatCOP(kpis.ventas_mes), icon: TrendingUp, bg: 'bg-blue-600', href: '/ventas/facturas' },
          { label: 'Cobrado este mes', value: formatCOP(kpis.cobrado_mes), icon: DollarSign, bg: 'bg-green-600', href: '/ventas/recibos' },
          { label: 'Compras este mes', value: formatCOP(kpis.compras_mes), icon: ShoppingCart, bg: 'bg-orange-600', href: '/compras/facturas' },
          { label: 'Gastos este mes', value: formatCOP(kpis.gastos_mes), icon: Receipt, bg: 'bg-purple-600', href: '/gastos' },
        ].map(k => (
          <Link key={k.label} href={k.href}
            className="rounded-xl bg-white border border-gray-100 p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} shrink-0`}>
              <k.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
              <p className="font-bold text-gray-900 dark:text-white">{k.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Cuerpo principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gráfica barras mensuales */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Ventas vs Compras vs Gastos {new Date().getFullYear()}</h3>
          <div className="flex items-end gap-2 h-36">
            {resumenFiltrado.map(m => (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: '110px' }}>
                  {/* Ventas */}
                  <div
                    className="w-full rounded-t bg-blue-500 min-h-[2px]"
                    style={{ height: `${Math.round((m.ventas / maxVal) * 100)}px` }}
                    title={`Ventas: ${formatCOP(m.ventas)}`}
                  />
                </div>
                <div className="w-full flex gap-0.5">
                  {/* Compras */}
                  <div className="flex-1 rounded bg-orange-400" style={{ height: `${Math.max(Math.round((m.compras / maxVal) * 30), 2)}px` }} title={`Compras: ${formatCOP(m.compras)}`} />
                  {/* Gastos */}
                  <div className="flex-1 rounded bg-purple-400" style={{ height: `${Math.max(Math.round((m.gastos / maxVal) * 30), 2)}px` }} title={`Gastos: ${formatCOP(m.gastos)}`} />
                </div>
                <span className="text-xs text-gray-400">{MESES[m.mes - 1]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" />Ventas</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Compras</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-purple-400" />Gastos</span>
          </div>
        </div>

        {/* Alertas + Top clientes */}
        <div className="flex flex-col gap-4">
          {/* Alertas */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Alertas
              {totalAlertas > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white font-bold">{totalAlertas}</span>
              )}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              {alertasStock.length > 0 && (
                <Link href="/productos/stock-bajo" className="rounded-lg bg-orange-50 p-3 hover:bg-orange-100 transition-colors dark:bg-orange-900/20 dark:hover:bg-orange-900/30">
                  <p className="font-medium text-orange-800 dark:text-orange-400">Stock bajo</p>
                  <p className="text-xs text-orange-600 dark:text-orange-500">{alertasStock.length} producto{alertasStock.length !== 1 ? 's' : ''} bajo mínimo</p>
                </Link>
              )}
              {facturasVencidas.length > 0 && (
                <Link href="/ventas/facturas" className="rounded-lg bg-red-50 p-3 hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/30">
                  <p className="font-medium text-red-800 dark:text-red-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Facturas vencidas
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500">{facturasVencidas.length} factura{facturasVencidas.length !== 1 ? 's' : ''} sin pagar</p>
                </Link>
              )}
              {kpis.por_pagar > 0 && (
                <Link href="/compras/facturas" className="rounded-lg bg-yellow-50 p-3 hover:bg-yellow-100 transition-colors dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30">
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">Compras pendientes</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500">{formatCOP(kpis.por_pagar)} por pagar</p>
                </Link>
              )}
              {totalAlertas === 0 && kpis.por_pagar === 0 && (
                <p className="text-center text-xs text-gray-400 py-3">Sin alertas pendientes ✓</p>
              )}
            </div>
          </div>

          {/* Top clientes */}
          {topClientes.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" /> Top clientes este mes
              </h3>
              <div className="flex flex-col gap-2">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">{c.razon_social}</span>
                    <span className="font-mono text-xs font-medium text-blue-700 dark:text-blue-400 shrink-0">{formatCOP(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tablas recientes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Últimas facturas de venta */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Últimas ventas</h3>
            <Link href="/ventas/facturas" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {(ultimasFacturas as Record<string, unknown>[]).map((f) => (
                <tr key={f.id as string} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                  <td className="py-2 pr-2">
                    <Link href={`/ventas/facturas/${f.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                      {f.prefijo as string}{f.numero as number}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-700 dark:text-gray-300 truncate max-w-28">
                    {(f.cliente as { razon_social?: string } | null)?.razon_social ?? '—'}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-medium text-gray-900 dark:text-gray-100">{formatCOP(f.total as number)}</td>
                  <td className="py-2 pl-2 text-right">
                    <Badge variant={f.estado === 'pagada' ? 'success' : 'warning'}>
                      {f.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {ultimasFacturas.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-gray-400">Sin facturas aún</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Últimas compras */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Últimas compras</h3>
            <Link href="/compras/facturas" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-50">
              {(ultimasCompras as Record<string, unknown>[]).map((c) => (
                <tr key={c.id as string} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                  <td className="py-2 pr-2">
                    <Link href={`/compras/facturas/${c.id}`} className="font-mono text-xs text-orange-600 hover:underline">
                      {c.prefijo as string}{c.numero as number}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-700 truncate max-w-28">
                    {(c.proveedor as { razon_social?: string } | null)?.razon_social ?? '—'}
                  </td>
                  <td className="py-2 text-right font-mono text-xs font-medium text-gray-900">{formatCOP(c.total as number)}</td>
                  <td className="py-2 pl-2 text-right">
                    <Badge variant={c.estado === 'pagada' ? 'success' : 'warning'}>
                      {c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </Badge>
                  </td>
                </tr>
              ))}
              {ultimasCompras.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-gray-400">Sin compras aún</td></tr>
              )}
            </tbody>
          </table>
          {/* Acceso rápido */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
            <Link href="/ventas/facturas/nueva"
              className="flex-1 text-center rounded-lg bg-blue-600 text-white text-xs py-2 font-medium hover:bg-blue-700 transition-colors">
              + Nueva venta
            </Link>
            <Link href="/compras/facturas/nueva"
              className="flex-1 text-center rounded-lg bg-orange-600 text-white text-xs py-2 font-medium hover:bg-orange-700 transition-colors">
              + Nueva compra
            </Link>
            <Link href="/gastos/nuevo"
              className="flex-1 text-center rounded-lg bg-purple-600 text-white text-xs py-2 font-medium hover:bg-purple-700 transition-colors">
              + Gasto
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
