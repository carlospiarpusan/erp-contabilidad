'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown, UserCircle, Settings, Building2, LockKeyhole } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { BusquedaGlobal } from '@/components/busqueda/BusquedaGlobal'
import { Notificaciones } from '@/components/layout/Notificaciones'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { canAccessModule, getRoleLabel, type AppRole } from '@/lib/auth/permissions'
import { BrandMark } from '@/components/brand/BrandMark'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { formatLongDateInAppTimeZone } from '@/lib/utils/dates'

interface HeaderProps {
  userName?: string
  userEmail?: string
  userRol?: AppRole
  tieneMultiEmpresa?: boolean
}

export function Header({ userName, userEmail, userRol, tieneMultiEmpresa }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [menu, setMenu] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menu) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menu])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const hoy = formatLongDateInAppTimeZone(new Date())

  const initials = userName
    ? userName.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()
    : (userEmail?.charAt(0) ?? 'U').toUpperCase()
  const puedeUsarERP = userRol ? canAccessModule(userRol, 'dashboard') : false
  const usersHref = userRol === 'superadmin'
    ? '/superadmin/usuarios'
    : userRol && canAccessModule(userRol, 'configuracion')
      ? '/configuracion/usuarios'
      : null

  return (
    <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between border-b border-white/60 bg-white/75 px-3 backdrop-blur-xl dark:border-gray-800/80 dark:bg-gray-950/82 sm:px-6">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" className="sm:hidden" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="hidden sm:block">
                <span className="dark:hidden"><BrandLogo className="!w-[122px]" /></span>
                <span className="hidden dark:block"><BrandLogo light className="!w-[122px]" /></span>
              </div>
            </div>
            <p className="hidden truncate text-[10px] capitalize leading-tight text-gray-500 dark:text-gray-400 sm:block">{hoy}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1 rounded-2xl border border-white/70 bg-white/70 px-1.5 py-1 shadow-sm shadow-slate-200/40 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70 dark:shadow-none sm:gap-1.5 sm:px-2">
          {puedeUsarERP && <BusquedaGlobal />}
          <ThemeToggle />
          {puedeUsarERP && <Notificaciones />}
        </div>

        <div className="h-7 w-px bg-gray-200/70 dark:bg-gray-800" />

        <div className="relative">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenu(p => !p)}
            aria-expanded={menu}
            className="flex items-center gap-2.5 rounded-2xl border border-white/70 bg-white/72 px-2.5 py-1.5 shadow-sm shadow-slate-200/40 backdrop-blur hover:bg-white dark:border-gray-800 dark:bg-gray-900/72 dark:shadow-none dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xs font-bold shadow-[0_10px_22px_rgba(19,148,135,0.22)]">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-[13px] font-semibold leading-tight text-gray-700 dark:text-gray-200">
                {userName ?? userEmail ?? 'Usuario'}
              </p>
              {userRol && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{getRoleLabel(userRol)}</p>
              )}
            </div>
            <ChevronDown className="h-3 w-3 text-gray-300 dark:text-gray-600" />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-gray-100 bg-white/96 py-1.5 shadow-2xl shadow-black/8 backdrop-blur-xl dark:border-gray-800 dark:bg-gray-950/96 dark:shadow-black/30">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{userName ?? 'Usuario'}</p>
                  <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
                </div>
                <Link
                  href="/configuracion/perfil"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                >
                  <UserCircle className="h-4 w-4 opacity-50" /> Mi perfil
                </Link>
                <Link
                  href="/cambiar-password"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                >
                  <LockKeyhole className="h-4 w-4 opacity-50" /> Cambiar contraseña
                </Link>
                {usersHref && (
                  <Link
                    href={usersHref}
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                  >
                    <Settings className="h-4 w-4 opacity-50" /> Usuarios
                  </Link>
                )}
                {tieneMultiEmpresa && (
                  <Link
                    href="/seleccionar-empresa"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                  >
                    <Building2 className="h-4 w-4 opacity-50" /> Cambiar empresa
                  </Link>
                )}
                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-4 w-4 opacity-60" /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
