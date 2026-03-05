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
} from 'lucide-react'
import { useState } from 'react'

const menuItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/',
  },
  {
    label: 'Ventas',
    icon: TrendingUp,
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
    children: [
      { label: 'Todos los clientes', href: '/clientes' },
      { label: 'Grupos', href: '/clientes/grupos' },
    ],
  },
  {
    label: 'Compras',
    icon: ShoppingCart,
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
    children: [
      { label: 'Registro de Gastos', href: '/gastos' },
      { label: 'Acreedores', href: '/gastos/acreedores' },
      { label: 'Tipos de Gasto', href: '/gastos/tipos' },
    ],
  },
  {
    label: 'Contabilidad',
    icon: BookOpen,
    children: [
      { label: 'Asientos', href: '/contabilidad/asientos' },
      { label: 'PUC Cuentas', href: '/contabilidad/cuentas' },
      { label: 'Ejercicios', href: '/contabilidad/ejercicios' },
      { label: 'Impuestos', href: '/contabilidad/impuestos' },
      { label: 'Formas de Pago', href: '/contabilidad/formas-pago' },
      { label: 'Consecutivos', href: '/contabilidad/consecutivos' },
    ],
  },
  {
    label: 'Informes',
    icon: BarChart3,
    children: [
      { label: 'Balances', href: '/informes/balances' },
      { label: 'Facturas', href: '/informes/facturas' },
      { label: 'Artículos', href: '/informes/articulos' },
      { label: 'Clientes', href: '/informes/clientes' },
      { label: 'Recibos', href: '/informes/recibos' },
    ],
  },
  {
    label: 'Configuración',
    icon: Settings,
    children: [
      { label: 'Datos de Empresa', href: '/configuracion/empresa' },
      { label: 'Bodegas', href: '/configuracion/bodegas' },
      { label: 'Transportadoras', href: '/configuracion/transportadoras' },
      { label: 'Usuarios', href: '/configuracion/usuarios' },
    ],
  },
]

function MenuItem({ item }: { item: typeof menuItems[number] }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(() => {
    if ('children' in item && item.children) {
      return item.children.some(c => pathname.startsWith(c.href))
    }
    return false
  })

  if ('children' in item && item.children) {
    const isActive = item.children.some(c => pathname.startsWith(c.href))
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        {open && (
          <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-gray-200 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'rounded-md px-2 py-1.5 text-sm transition-colors',
                  pathname === child.href
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900">ERP Contable</span>
          <span className="text-xs text-gray-500">Maria Esperanza T.</span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {menuItems.map((item) => (
            <MenuItem key={item.label} item={item} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-400">v1.0.0 — Colombia 🇨🇴</p>
      </div>
    </aside>
  )
}
