'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, ChevronDown, UserCircle, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { BusquedaGlobal } from '@/components/busqueda/BusquedaGlobal'
import { Notificaciones } from '@/components/layout/Notificaciones'
import { useState } from 'react'
import Link from 'next/link'
import { canAccessModule, getRoleLabel, type AppRole } from '@/lib/auth/permissions'

interface HeaderProps {
  titulo: string
  userName?: string
  userEmail?: string
  userRol?: AppRole
}

export function Header({ titulo, userName, userEmail, userRol }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [menu, setMenu] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const hoy = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date())

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
    <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 dark:border-gray-800 dark:bg-gray-950">
      <div>
        <h1 className="text-[15px] font-semibold text-gray-800 dark:text-gray-200 leading-tight">{titulo}</h1>
        <p className="text-[11px] text-gray-400 capitalize dark:text-gray-500 leading-tight">{hoy}</p>
      </div>

      <div className="flex items-center gap-1.5">
        {puedeUsarERP && <BusquedaGlobal />}
        <ThemeToggle />
        {puedeUsarERP && <Notificaciones />}

        {/* Separator */}
        <div className="h-6 w-px bg-gray-100 dark:bg-gray-800 mx-1" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenu(p => !p)}
            aria-expanded={menu}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 text-white text-xs font-bold shadow-sm shadow-teal-500/20">
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
              <div className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-gray-100 bg-white py-1.5 shadow-xl shadow-black/8 dark:border-gray-800 dark:bg-gray-950 dark:shadow-black/30">
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
                {usersHref && (
                  <Link
                    href={usersHref}
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900 transition-colors"
                  >
                    <Settings className="h-4 w-4 opacity-50" /> Usuarios
                  </Link>
                )}
                <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
                <button
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
