'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/utils/cn'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { UserSession } from '@/lib/auth/session'
import { getRoleLabel } from '@/lib/auth/permissions'
import { getVisibleNavigation, type NavigationItem } from '@/components/layout/navigation'
import { BrandMark } from '@/components/brand/BrandMark'

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
            'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
            isActive
              ? isSuperadmin
                ? 'bg-violet-500/10 text-violet-600 ring-1 ring-violet-500/10 dark:text-violet-400'
                : 'bg-teal-500/10 text-teal-700 ring-1 ring-teal-500/10 dark:text-teal-300'
              : isSuperadmin
                ? 'text-violet-500/80 hover:bg-violet-500/5 hover:text-violet-600 dark:text-violet-400/70 dark:hover:text-violet-400'
                : 'text-gray-500 hover:bg-white/80 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-900/80 dark:hover:text-gray-300'
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
          <div className="ml-[22px] mt-1 flex flex-col gap-1 border-l-2 border-gray-100 dark:border-gray-800 pl-3 pb-1">
            {item.children.map((child) => {
              const childActive = isCurrentPath(pathname, child.href)
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  prefetch={false}
                  className={cn(
                    'rounded-xl px-2.5 py-1.5 text-[13px] transition-all duration-150',
                    childActive
                      ? isSuperadmin
                        ? 'bg-violet-600 text-white font-semibold shadow-sm shadow-violet-600/25'
                        : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold shadow-sm shadow-teal-600/25'
                      : 'text-gray-500 hover:bg-white hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-300'
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
    <aside className="flex h-screen w-[272px] shrink-0 flex-col border-r border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,250,255,0.94))] dark:border-gray-800 dark:bg-[linear-gradient(180deg,rgba(10,17,27,0.98),rgba(16,24,36,0.98))]">
      <div className="px-4 pb-3 pt-4">
        <div className="clovent-panel rounded-[1.6rem] px-4 py-4">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <span className="block truncate text-sm font-black tracking-[-0.03em] text-gray-900 dark:text-gray-100">
                {empresaNombre ?? 'ClovEnt'}
              </span>
              <span className="mt-1 inline-flex rounded-full border border-teal-500/12 bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
                clovent.co
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50/80 px-3 py-2 dark:bg-gray-900/80">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Perfil</span>
            <span className={cn(
              'text-[11px] font-semibold',
              rol === 'superadmin'
                ? 'text-violet-500'
                : 'text-gray-500 dark:text-gray-400'
            )}>
              {rol === 'superadmin' ? 'Superadmin' : getRoleLabel(rol)}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <div className="flex flex-col gap-1">
          {visibles.map((item) => (
            <MenuItemComponent key={`${item.label}:${pathname}`} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>

      <div className="px-4 pb-4 pt-2">
        <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-[11px] text-gray-400 shadow-sm shadow-slate-200/30 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-500 dark:shadow-none">
          <p className="font-semibold text-gray-500 dark:text-gray-400">ClovEnt</p>
          <p className="mt-1">v1.0 · Colombia</p>
        </div>
      </div>
    </aside>
  )
}
