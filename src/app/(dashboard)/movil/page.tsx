export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { ComponentType } from 'react'
import { getSession } from '@/lib/auth/session'
import { canAccessModule } from '@/lib/auth/permissions'
import { formatCOP } from '@/utils/cn'
import {
  ArrowRight,
  Bell,
  CreditCard,
  FilePlus2,
  LayoutDashboard,
  Lightbulb,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Users,
  Warehouse,
} from 'lucide-react'
import {
  getAlertasSinRotacion,
  getAlertasStock,
  getFacturasVencidas,
  getKPIsDashboard,
  getUltimasCompras,
  getUltimasFacturas,
} from '@/lib/db/dashboard'

type QuickAction = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  accent: string
}

function getPartyName(
  party: { razon_social?: string | null } | Array<{ razon_social?: string | null }> | null | undefined
) {
  if (Array.isArray(party)) {
    return party[0]?.razon_social ?? null
  }

  return party?.razon_social ?? null
}

async function loadMobileHome() {
  try {
    const [kpis, ultimasFacturas, ultimasCompras, alertasStock, alertasSinRotacion, facturasVencidas] = await Promise.all([
      getKPIsDashboard(),
      getUltimasFacturas(4),
      getUltimasCompras(4),
      getAlertasStock(),
      getAlertasSinRotacion(6),
      getFacturasVencidas(),
    ])

    return { kpis, ultimasFacturas, ultimasCompras, alertasStock, alertasSinRotacion, facturasVencidas }
  } catch {
    return null
  }
}

export default async function MobileHomePage() {
  const session = await getSession()
  const data = await loadMobileHome()

  const quickActions: QuickAction[] = [
    { label: 'POS', href: '/pos', icon: CreditCard, accent: 'from-teal-500 to-teal-700' },
    { label: 'Nueva venta', href: '/ventas/facturas/nueva', icon: FilePlus2, accent: 'from-sky-500 to-blue-700' },
    { label: 'Ventas', href: '/ventas/facturas', icon: TrendingUp, accent: 'from-indigo-500 to-indigo-700' },
    { label: 'Compras', href: '/compras/facturas', icon: ShoppingCart, accent: 'from-amber-500 to-orange-700' },
    { label: 'Productos', href: '/productos', icon: Package, accent: 'from-violet-500 to-fuchsia-700' },
    { label: 'Clientes', href: '/clientes', icon: Users, accent: 'from-emerald-500 to-emerald-700' },
  ].filter((item) => {
    if (!session) return false
    if (item.href.startsWith('/compras')) return canAccessModule(session.rol, 'compras')
    if (item.href.startsWith('/productos')) return canAccessModule(session.rol, 'productos')
    if (item.href.startsWith('/clientes')) return canAccessModule(session.rol, 'clientes')
    return canAccessModule(session.rol, 'ventas')
  })

  const secondaryActions: QuickAction[] = [
    { label: 'Sugeridos', href: '/compras/sugeridos', icon: Lightbulb, accent: 'from-cyan-500 to-cyan-700' },
    { label: 'Kardex', href: '/inventario/kardex', icon: Warehouse, accent: 'from-slate-500 to-slate-700' },
    { label: 'Notificaciones', href: '/notificaciones', icon: Bell, accent: 'from-rose-500 to-pink-700' },
    { label: 'Dashboard', href: '/', icon: LayoutDashboard, accent: 'from-gray-500 to-gray-800' },
  ].filter((item) => {
    if (!session) return false
    if (item.href.startsWith('/compras')) return canAccessModule(session.rol, 'compras')
    if (item.href.startsWith('/inventario')) return canAccessModule(session.rol, 'inventario')
    if (item.href.startsWith('/notificaciones')) return canAccessModule(session.rol, 'notificaciones')
    return true
  })

  const kpis = data?.kpis
  const totalAlertas = (data?.alertasStock.length ?? 0) + (data?.alertasSinRotacion.length ?? 0) + (data?.facturasVencidas.length ?? 0)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pb-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/50 bg-[linear-gradient(160deg,rgba(13,148,136,0.95),rgba(15,23,42,0.96))] p-5 text-white shadow-[0_22px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-100/85">ClovEnt móvil</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.05em]">Hola, {session?.nombre?.split(' ')[0] ?? 'equipo'}</h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-teal-50/80">
              Accesos rápidos, alertas y movimiento comercial en formato celular.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-right backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/65">Empresa</p>
            <p className="mt-1 text-sm font-semibold">{session?.empresa_nombre ?? 'ClovEnt'}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Ventas mes</p>
            <p className="mt-1 text-lg font-bold">{formatCOP(kpis?.ventas_mes ?? 0)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Por cobrar</p>
            <p className="mt-1 text-lg font-bold">{formatCOP(kpis?.por_cobrar ?? 0)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Acciones rápidas</h2>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
            Celular
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-[1.4rem] border border-gray-100 bg-gray-50/70 p-3 transition-transform hover:-translate-y-0.5 dark:border-gray-800 dark:bg-gray-900/70"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-sm`}>
                <item.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-bold text-gray-900 dark:text-gray-100">{item.label}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                Abrir <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Compras mes</p>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{formatCOP(kpis?.compras_mes ?? 0)}</p>
        </div>
        <div className="rounded-[1.5rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Por pagar</p>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-gray-100">{formatCOP(kpis?.por_pagar ?? 0)}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Alertas clave</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Lo que más conviene revisar desde celular</p>
          </div>
        </div>
        <div className="grid gap-2.5">
          <div className="rounded-2xl bg-gray-50 px-3 py-3 dark:bg-gray-900/80">
            <p className="text-xs text-gray-500 dark:text-gray-400">Alertas totales</p>
            <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{totalAlertas}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-orange-50 px-3 py-3 text-center dark:bg-orange-500/10">
              <p className="text-[11px] text-orange-600 dark:text-orange-300">Stock bajo</p>
              <p className="mt-1 text-base font-bold text-orange-700 dark:text-orange-200">{data?.alertasStock.length ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 px-3 py-3 text-center dark:bg-violet-500/10">
              <p className="text-[11px] text-violet-600 dark:text-violet-300">Sin rotación</p>
              <p className="mt-1 text-base font-bold text-violet-700 dark:text-violet-200">{data?.alertasSinRotacion.length ?? 0}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-3 text-center dark:bg-rose-500/10">
              <p className="text-[11px] text-rose-600 dark:text-rose-300">Vencidas</p>
              <p className="mt-1 text-base font-bold text-rose-700 dark:text-rose-200">{data?.facturasVencidas.length ?? 0}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Más accesos</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {secondaryActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.2rem] border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/70"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white`}>
                <item.icon className="h-4.5 w-4.5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{item.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Últimas ventas</h2>
            <Link href="/ventas/facturas" className="text-xs font-semibold text-teal-700 dark:text-teal-300">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {(data?.ultimasFacturas ?? []).slice(0, 4).map((factura) => (
              <Link key={factura.id} href={`/ventas/facturas/${factura.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 py-3 dark:bg-gray-900/80">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {getPartyName(factura.cliente) ?? `${factura.prefijo}${factura.numero}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{factura.prefijo}{factura.numero}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">{formatCOP(factura.total ?? 0)}</p>
              </Link>
            ))}
            {(data?.ultimasFacturas ?? []).length === 0 && (
              <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                Todavía no hay ventas recientes.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Últimas compras</h2>
            <Link href="/compras/facturas" className="text-xs font-semibold text-teal-700 dark:text-teal-300">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {(data?.ultimasCompras ?? []).slice(0, 4).map((compra) => (
              <Link key={compra.id} href={`/compras/facturas/${compra.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 py-3 dark:bg-gray-900/80">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {getPartyName(compra.proveedor) ?? `${compra.prefijo}${compra.numero}`}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{compra.prefijo}{compra.numero}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">{formatCOP(compra.total ?? 0)}</p>
              </Link>
            ))}
            {(data?.ultimasCompras ?? []).length === 0 && (
              <p className="rounded-2xl bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-900/80 dark:text-gray-400">
                Todavía no hay compras recientes.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
