import type { ElementType } from 'react'
import {
  BarChart3,
  Bell,
  BookOpen,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'
import { canAccessModule, getRolesForModule, type AppModule, type AppRole } from '@/lib/auth/permissions'

export interface NavigationChild {
  label: string
  href: string
  module?: AppModule
}

export interface NavigationItem {
  label: string
  icon: ElementType
  href?: string
  module: AppModule
  children?: readonly NavigationChild[]
  accent?: 'superadmin'
}

const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    label: 'Panel Admin',
    icon: LayoutDashboard,
    href: '/superadmin',
    module: 'superadmin',
    accent: 'superadmin',
  },
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
    module: 'dashboard',
  },
  {
    label: 'Notificaciones',
    icon: Bell,
    href: '/notificaciones',
    module: 'notificaciones',
  },
  {
    label: 'Ventas',
    icon: TrendingUp,
    module: 'ventas',
    children: [
      { label: 'Punto de Venta (POS)', href: '/pos' },
      { label: 'Facturas de Venta', href: '/ventas/facturas' },
      { label: 'Recibos de Caja', href: '/ventas/recibos' },
      { label: 'Cotizaciones', href: '/ventas/cotizaciones' },
      { label: 'Pedidos', href: '/ventas/pedidos' },
      { label: 'Remisiones', href: '/ventas/remisiones' },
      { label: 'Lista de Precios', href: '/ventas/precios' },
      { label: 'Notas Crédito', href: '/ventas/notas-credito' },
      { label: 'Notas Débito', href: '/ventas/notas-debito' },
      { label: 'Garantías', href: '/ventas/garantias' },
      { label: 'Servicio Técnico', href: '/ventas/servicios' },
    ],
  },
  {
    label: 'Clientes',
    icon: Users,
    module: 'clientes',
    children: [
      { label: 'Todos los clientes', href: '/clientes' },
      { label: 'Grupos', href: '/clientes/grupos' },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingCart,
    module: 'compras',
    children: [
      { label: 'Facturas de Compra', href: '/compras/facturas' },
      { label: 'Órdenes de Compra', href: '/compras/ordenes' },
      { label: 'Sugeridos', href: '/compras/sugeridos' },
      { label: 'Recibos de Compra', href: '/compras/recibos' },
      { label: 'Proveedores', href: '/compras/proveedores' },
    ],
  },
  {
    label: 'Productos',
    icon: Package,
    module: 'productos',
    children: [
      { label: 'Artículos', href: '/productos' },
      { label: 'Stock bajo', href: '/productos/stock-bajo' },
      { label: 'Ajuste inventario', href: '/inventario/ajuste', module: 'inventario' },
      { label: 'Catálogo', href: '/productos/catalogo' },
      { label: 'Fabricantes', href: '/productos/fabricantes' },
      { label: 'Familias', href: '/productos/familias' },
    ],
  },
  {
    label: 'Gastos',
    icon: Receipt,
    module: 'gastos',
    children: [
      { label: 'Registro de Gastos', href: '/gastos' },
      { label: 'Acreedores', href: '/gastos/acreedores' },
      { label: 'Tipos de Gasto', href: '/gastos/tipos' },
    ],
  },
  {
    label: 'Contabilidad',
    icon: BookOpen,
    module: 'contabilidad',
    children: [
      { label: 'Asientos', href: '/contabilidad/asientos' },
      { label: 'PUC Cuentas', href: '/contabilidad/cuentas' },
      { label: 'Cuentas Especiales', href: '/contabilidad/cuentas-especiales' },
      { label: 'Ejercicios', href: '/contabilidad/ejercicios' },
      { label: 'Impuestos', href: '/contabilidad/impuestos' },
      { label: 'Formas de Pago', href: '/contabilidad/formas-pago' },
      { label: 'Consecutivos', href: '/contabilidad/consecutivos' },
      { label: 'Generar Asientos', href: '/contabilidad/asientos-masivo' },
    ],
  },
  {
    label: 'Informes',
    icon: BarChart3,
    module: 'informes',
    children: [
      { label: 'Balances', href: '/informes/balances' },
      { label: 'Cartera', href: '/informes/cartera' },
      { label: 'Cuentas por Pagar', href: '/informes/cuentas-por-pagar' },
      { label: 'Comisiones', href: '/informes/comisiones' },
      { label: 'Sumas y Saldos', href: '/informes/sumas-saldos' },
      { label: 'Balance de Situación', href: '/informes/balance-situacion' },
      { label: 'PyG', href: '/informes/pyg' },
      { label: 'Libro Mayor', href: '/informes/libro-mayor' },
      { label: 'Facturas', href: '/informes/facturas' },
      { label: 'Ventas por Medio de Pago', href: '/informes/ventas-por-medio-pago' },
      { label: 'Pedidos', href: '/informes/pedidos' },
      { label: 'Cotizaciones', href: '/informes/cotizaciones' },
      { label: 'Remisiones', href: '/informes/remisiones' },
      { label: 'Artículos', href: '/informes/articulos' },
      { label: 'Clientes', href: '/informes/clientes' },
      { label: 'Recibos', href: '/informes/recibos' },
    ],
  },
  {
    label: 'Configuración',
    icon: Settings,
    module: 'configuracion',
    children: [
      { label: 'Datos de Empresa', href: '/configuracion/empresa' },
      { label: 'Colaboradores', href: '/configuracion/colaboradores' },
      { label: 'Bodegas', href: '/configuracion/bodegas' },
      { label: 'Transportadoras', href: '/configuracion/transportadoras' },
      { label: 'Usuarios', href: '/configuracion/usuarios' },
      { label: 'Importar datos', href: '/configuracion/importar' },
      { label: 'Auditoría', href: '/configuracion/auditoria' },
    ],
  },
  {
    label: 'Superadmin',
    icon: Shield,
    module: 'superadmin',
    accent: 'superadmin',
    children: [
      { label: 'Empresas', href: '/superadmin/empresas' },
      { label: 'Todos los usuarios', href: '/superadmin/usuarios' },
    ],
  },
] as const

function getChildModule(item: NavigationItem, child: NavigationChild) {
  return child.module ?? item.module
}

export function getVisibleNavigation(role: AppRole) {
  return NAVIGATION_ITEMS
    .filter((item) => canAccessModule(role, item.module))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canAccessModule(role, getChildModule(item, child))),
    }))
    .filter((item) => item.href || (item.children?.length ?? 0) > 0)
}

export function getNavigationRoles(module: AppModule) {
  return getRolesForModule(module)
}
