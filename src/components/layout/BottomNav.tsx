'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, TrendingUp, Package, Menu } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useMobileLayout } from '@/components/layout/MobileLayoutProvider'

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Inicio', href: '/' },
  { icon: ShoppingCart, label: 'POS', href: '/pos' },
  { icon: TrendingUp, label: 'Ventas', href: '/ventas/facturas' },
  { icon: Package, label: 'Productos', href: '/productos' },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export function BottomNav() {
  const pathname = usePathname()
  const { setSidebarOpen } = useMobileLayout()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-gray-200 bg-white/95 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
              active
                ? 'text-teal-600 dark:text-teal-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          >
            <item.icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
            <span>{item.label}</span>
          </Link>
        )
      })}

      {/* "Más" button opens sidebar drawer */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-gray-400 transition-colors dark:text-gray-500"
      >
        <Menu className="h-5 w-5" />
        <span>Más</span>
      </button>
    </nav>
  )
}
