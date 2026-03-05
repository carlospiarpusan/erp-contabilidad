'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Receipt,
  BookOpen,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Building2,
  Shield,
} from 'lucide-react'
import { useState } from 'react'
import type { UserSession } from '@/lib/auth/session'

type Rol = UserSession['rol']

interface MenuChild { label: string; href: string }
interface MenuItem {
  label: string
  icon: React.ElementType
  href?: string
  children?: MenuChild[]
  roles: Rol[]
}

const menuItems: MenuItem[] = [
  {
    label: 'Panel Admin',
    icon: LayoutDashboard,
    href: '/superadmin',
    roles: ['superadmin'],
  },
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
    roles: ['admin', 'contador', 'vendedor', 'solo_lectura'],
  },
  {
    label: 'Ventas',
    icon: TrendingUp,
    roles: ['admin', 'contador', 'vendedor', 'solo_lectura'],
    children: [
      { label: 'Facturas de Venta', href: '/ventas/facturas' },
      { label: 'Recibos de Caja', href: '/ventas/recibos' },
      { label: 'Cotizaciones', href: '/ventas/cotizaciones' },
      { label: 'Pedidos', href: '/ventas/pedidos' },
      { label: 'Remisiones', href: '/ventas/remisiones' },
      { label: 'Lista de Precios', href: '/ventas/precios' },
      { label: 'Garantías', href: '/ventas/garantias' },
      { label: 'Servicio Técnico', href: '/ventas/servicios' },
    ],
  },
  {
    label: 'Clientes',
    icon: Users,
    roles: ['admin', 'contador', 'vendedor', 'solo_lectura'],
    children: [
      { label: 'Todos los clientes', href: '/clientes' },
      { label: 'Grupos', href: '/clientes/grupos' },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingCart,
    roles: ['admin', 'contador'],
    children: [
      { label: 'Facturas de Compra', href: '/compras/facturas' },
      { label: 'Órdenes de Compra', href: '/compras/ordenes' },
      { label: 'Recibos de Compra', href: '/compras/recibos' },
      { label: 'Proveedores', href: '/compras/proveedores' },
    ],
  },
  {
    label: 'Productos',
    icon: Package,
    roles: ['admin', 'contador', 'vendedor', 'solo_lectura'],
    children: [
      { label: 'Artículos', href: '/productos' },
      { label: 'Stock bajo', href: '/productos/stock-bajo' },
      { label: 'Catálogo', href: '/productos/catalogo' },
      { label: 'Fabricantes', href: '/productos/fabricantes' },
      { label: 'Familias', href: '/productos/familias' },
    ],
  },
  {
    label: 'Gastos',
    icon: Receipt,
    roles: ['admin', 'contador'],
    children: [
      { label: 'Registro de Gastos', href: '/gastos' },
      { label: 'Acreedores', href: '/gastos/acreedores' },
      { label: 'Tipos de Gasto', href: '/gastos/tipos' },
    ],
  },
  {
    label: 'Contabilidad',
    icon: BookOpen,
    roles: ['admin', 'contador'],
    children: [
      { label: 'Asientos', href: '/contabilidad/asientos' },
      { label: 'PUC Cuentas', href: '/contabilidad/cuentas' },
      { label: 'Cuentas Especiales', href: '/contabilidad/cuentas-especiales' },
      { label: 'Ejercicios', href: '/contabilidad/ejercicios' },
      { label: 'Impuestos', href: '/contabilidad/impuestos' },
      { label: 'Formas de Pago', href: '/contabilidad/formas-pago' },
      { label: 'Consecutivos', href: '/contabilidad/consecutivos' },
    ],
  },
  {
    label: 'Informes',
    icon: BarChart3,
    roles: ['admin', 'contador', 'vendedor'],
    children: [
      { label: 'Balances', href: '/informes/balances' },
      { label: 'Facturas', href: '/informes/facturas' },
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
    roles: ['admin'],
    children: [
      { label: 'Datos de Empresa', href: '/configuracion/empresa' },
      { label: 'Colaboradores', href: '/configuracion/colaboradores' },
      { label: 'Bodegas', href: '/configuracion/bodegas' },
      { label: 'Transportadoras', href: '/configuracion/transportadoras' },
      { label: 'Usuarios', href: '/configuracion/usuarios' },
    ],
  },
  {
    label: 'Superadmin',
    icon: Shield,
    roles: ['superadmin'],
    children: [
      { label: 'Empresas', href: '/superadmin/empresas' },
      { label: 'Todos los usuarios', href: '/superadmin/usuarios' },
    ],
  },
]

function MenuItemComponent({ item }: { item: MenuItem }) {
  const pathname = usePathname()
  const isSuperadmin = item.label === 'Superadmin'
  const [open, setOpen] = useState(() => {
    if (item.children) return item.children.some(c => pathname.startsWith(c.href))
    return false
  })

  if (item.children) {
    const isActive = item.children.some(c => pathname.startsWith(c.href))
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? isSuperadmin
                ? 'bg-violet-50 text-violet-700 font-medium dark:bg-violet-900/20 dark:text-violet-400'
                : 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-400'
              : isSuperadmin
                ? 'text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/10'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {open && (
          <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-gray-200 dark:border-gray-800 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'rounded-md px-2 py-1.5 text-sm transition-colors',
                  pathname === child.href
                    ? isSuperadmin
                      ? 'bg-violet-600 text-white font-medium'
                      : 'bg-blue-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = pathname === item.href
  return (
    <Link
      href={item.href!}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-blue-600 text-white font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

interface SidebarProps {
  rol?: Rol
  empresaNombre?: string
}

export function Sidebar({ rol = 'solo_lectura', empresaNombre }: SidebarProps) {
  const visibles = menuItems.filter(item => item.roles.includes(rol))

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {empresaNombre ?? 'ERP Contable'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {rol === 'superadmin' ? '⚡ Superadmin' : rol.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {visibles.map((item) => (
            <MenuItemComponent key={item.label} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">v1.0.0 — Colombia 🇨🇴</p>
      </div>
    </aside>
  )
}
