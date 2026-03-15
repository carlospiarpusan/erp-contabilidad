export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Cog,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  UserCircle,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { canAccessModule, getRoleLabel, type AppModule } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'
import { cardCls } from '@/utils/cn'

type HelpCard = {
  title: string
  description: string
  href: string
  module: AppModule
  icon: LucideIcon
}

const HELP_CARDS: readonly HelpCard[] = [
  {
    title: 'Dashboard',
    description: 'KPIs, alertas y accesos rápidos para el día a día.',
    href: '/',
    module: 'dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Ventas',
    description: 'Facturas, recibos, cotizaciones, pedidos y remisiones.',
    href: '/ventas/facturas',
    module: 'ventas',
    icon: TrendingUp,
  },
  {
    title: 'Compras',
    description: 'Facturas, órdenes, proveedores y sugeridos de compra.',
    href: '/compras/facturas',
    module: 'compras',
    icon: ShoppingCart,
  },
  {
    title: 'Productos',
    description: 'Catálogo, familias, fabricantes y stock bajo.',
    href: '/productos',
    module: 'productos',
    icon: Package,
  },
  {
    title: 'Gastos',
    description: 'Registro de gastos operativos, acreedores y tipos.',
    href: '/gastos',
    module: 'gastos',
    icon: Receipt,
  },
  {
    title: 'Contabilidad',
    description: 'Asientos, PUC, impuestos, ejercicios y consecutivos.',
    href: '/contabilidad/asientos',
    module: 'contabilidad',
    icon: BookOpen,
  },
  {
    title: 'Informes',
    description: 'Balances, cartera, recibos y reportes de documentos.',
    href: '/informes/balances',
    module: 'informes',
    icon: BarChart3,
  },
  {
    title: 'Configuración',
    description: 'Empresa, usuarios, bodegas, transportadoras e importaciones.',
    href: '/configuracion/empresa',
    module: 'configuracion',
    icon: Cog,
  },
  {
    title: 'Mi perfil',
    description: 'Actualiza tus datos, contraseña y MFA.',
    href: '/configuracion/perfil',
    module: 'perfil',
    icon: UserCircle,
  },
] as const

const REPO_DOCS = [
  {
    title: 'README',
    path: 'README.md',
    description: 'Resumen de plataforma, roles, despliegue y variables de entorno.',
  },
  {
    title: 'Arquitectura técnica',
    path: 'docs/ARQUITECTURA_TECNICA.md',
    description: 'Estructura por capas, decisiones técnicas y dependencias clave.',
  },
  {
    title: 'Rutas App',
    path: 'docs/RUTAS_APP.md',
    description: 'Inventario de páginas protegidas y pantallas del dashboard.',
  },
  {
    title: 'Rutas API',
    path: 'docs/RUTAS_API.md',
    description: 'Mapa de endpoints por dominio del ERP.',
  },
  {
    title: 'Operación y verificación',
    path: 'docs/OPERACION_VERIFICACION.md',
    description: 'Checks de despliegue, QA y validaciones operativas.',
  },
  {
    title: 'Handbook IA',
    path: 'docs/IA_HANDBOOK.md',
    description: 'Guía operativa para agentes y automatizaciones internas.',
  },
] as const

export default async function DocumentacionPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.rol === 'superadmin') redirect('/superadmin')

  const visibleCards = HELP_CARDS.filter((card) => canAccessModule(session.rol, card.module))

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-6 dark:border-blue-900/40 dark:from-blue-950/20 dark:via-gray-950 dark:to-cyan-950/10">
        <div className="flex items-center gap-2">
          <Badge variant="info">Centro de ayuda</Badge>
          <Badge variant="outline">Rol: {getRoleLabel(session.rol)}</Badge>
          {session.empresa_nombre ? <Badge variant="outline">{session.empresa_nombre}</Badge> : null}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Documentación interna</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            Este espacio reúne accesos rápidos al ERP y la referencia operativa del proyecto para soporte,
            onboarding y resolución de incidencias.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Accesos rápidos por módulo</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  <card.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-300" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900 dark:text-gray-100">{card.title}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{card.description}</p>
              <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-300">{card.href}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Documentos base del proyecto</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Referencia rápida de los archivos que concentran la documentación funcional, técnica y operativa.
          </p>
          <div className="mt-4 grid gap-3">
            {REPO_DOCS.map((doc) => (
              <div key={doc.path} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <p className="font-medium text-gray-900 dark:text-gray-100">{doc.title}</p>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{doc.description}</p>
                <code className="mt-2 inline-flex rounded bg-white px-2 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {doc.path}
                </code>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Checklist rápido</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <div className="rounded-lg border border-green-100 bg-green-50 p-3 dark:border-green-900/40 dark:bg-green-950/20">
              <p className="font-medium text-green-900 dark:text-green-200">Antes de operar</p>
              <p className="mt-1">Verifica rol, empresa activa, ejercicio contable y formas de pago disponibles.</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="font-medium text-blue-900 dark:text-blue-200">Si un documento falla</p>
              <p className="mt-1">Revisa consecutivos, cuentas especiales, impuestos y stock antes de reintentar.</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-medium text-amber-900 dark:text-amber-200">Si hay dudas de permisos</p>
              <p className="mt-1">Compara el rol del usuario con el módulo y confirma aislamiento por empresa.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
