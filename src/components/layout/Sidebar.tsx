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
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
            isActive
              ? isSuperadmin
                ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'bg-teal-500/10 text-teal-700 dark:text-teal-400'
              : isSuperadmin
                ? 'text-violet-500/80 hover:bg-violet-500/5 hover:text-violet-600 dark:text-violet-400/70 dark:hover:text-violet-400'
                : 'text-gray-500 hover:bg-gray-500/5 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          )}
        >
          <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? '' : 'opacity-60')} />
          <span className="flex-1 text-left">{item.label}</span>
          {open
            ? <ChevronDown className="h-3.5 w-3.5 opacity-40" />
            : <ChevronRight className="h-3.5 w-3.5 opacity-40" />
          }
        </button>
        {open && (
          <div className="ml-[22px] mt-0.5 flex flex-col gap-px border-l-2 border-gray-100 dark:border-gray-800 pl-3 pb-1">
            {item.children.map((child) => {
              const childActive = isCurrentPath(pathname, child.href)
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  prefetch={false}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[13px] transition-all duration-150',
                    childActive
                      ? isSuperadmin
                        ? 'bg-violet-600 text-white font-semibold shadow-sm shadow-violet-600/25'
                        : 'bg-teal-600 text-white font-semibold shadow-sm shadow-teal-600/25'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-300'
                  )}
                >
                  {child.label}
                </Link>
              )
            })}
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
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
        isActive
          ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/25'
          : 'text-gray-500 hover:bg-gray-500/5 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      )}
    >
      <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? '' : 'opacity-60')} />
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
    <aside className="flex h-screen w-[260px] shrink-0 flex-col bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/25">
          <Building2 className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
            {empresaNombre ?? 'ERP Contable'}
          </span>
          <span className={cn(
            'text-[11px] font-medium leading-tight mt-0.5',
            rol === 'superadmin'
              ? 'text-violet-500'
              : 'text-gray-400 dark:text-gray-500'
          )}>
            {rol === 'superadmin' ? 'Superadmin' : getRoleLabel(rol)}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <div className="flex flex-col gap-0.5">
          {visibles.map((item) => (
            <MenuItemComponent key={`${item.label}:${pathname}`} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="mx-4 h-px bg-gray-100 dark:bg-gray-800" />
      <div className="px-5 py-3">
        <p className="text-[11px] text-gray-300 dark:text-gray-700 font-medium">v1.0 · Colombia</p>
      </div>
    </aside>
  )
}
