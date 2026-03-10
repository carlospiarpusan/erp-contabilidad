'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'
import { Building2, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { UserSession } from '@/lib/auth/session'
import { getRoleLabel } from '@/lib/auth/permissions'
import { getVisibleNavigation, type NavigationItem } from '@/components/layout/navigation'

type Rol = UserSession['rol']

function isCurrentPath(pathname: string, href: string) {
  if (href === '/') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function MenuItemComponent({
  item,
  pathname,
}: {
  item: NavigationItem & { children?: readonly { label: string; href: string }[] }
  pathname: string
}) {
  const isSuperadmin = item.accent === 'superadmin'
  const hasActiveChild = item.children?.some((child) => isCurrentPath(pathname, child.href)) ?? false
  const [open, setOpen] = useState(hasActiveChild)

  if (item.children) {
    const isActive = hasActiveChild
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? isSuperadmin
                ? 'bg-violet-50 text-violet-700 font-medium dark:bg-violet-900/30 dark:text-violet-300'
                : 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
              : isSuperadmin
                ? 'text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-900/25'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-100'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {open && (
          <div className="ml-7 mt-1 flex flex-col gap-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                prefetch={false}
                className={cn(
                  'rounded-md px-2 py-1.5 text-sm transition-colors',
                  isCurrentPath(pathname, child.href)
                    ? isSuperadmin
                      ? 'bg-violet-600 text-white font-medium dark:bg-violet-500'
                      : 'bg-blue-600 text-white font-medium dark:bg-blue-500'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-100'
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

  const isActive = isCurrentPath(pathname, item.href!)
  return (
    <Link
      href={item.href!}
      prefetch={false}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-blue-600 text-white font-medium dark:bg-blue-500'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/80 dark:hover:text-gray-100'
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
  const pathname = usePathname()
  const visibles = getVisibleNavigation(rol)

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white/95 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {empresaNombre ?? 'ERP Contable'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {rol === 'superadmin' ? `⚡ ${getRoleLabel(rol)}` : getRoleLabel(rol)}
          </span>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {visibles.map((item) => (
            <MenuItemComponent key={`${item.label}:${pathname}`} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">v1.0.0 — Colombia 🇨🇴</p>
      </div>
    </aside>
  )
}
