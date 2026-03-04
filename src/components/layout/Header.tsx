'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, Bell, ChevronDown, UserCircle, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { BusquedaGlobal } from '@/components/busqueda/BusquedaGlobal'
import { useState } from 'react'
import Link from 'next/link'

interface HeaderProps {
  titulo: string
  userName?: string
  userEmail?: string
  userRol?: string
}

export function Header({ titulo, userName, userEmail, userRol }: HeaderProps) {
  const router   = useRouter()
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

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 dark:bg-gray-900 dark:border-gray-700">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{titulo}</h1>
        <p className="text-xs text-gray-500 capitalize">{hoy}</p>
      </div>

      <div className="flex items-center gap-2">
        <BusquedaGlobal />
        <ThemeToggle />

        <button className="relative rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenu(p => !p)}
            className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-none text-gray-700 dark:text-gray-200">
                {userName ?? userEmail ?? 'Usuario'}
              </p>
              {userRol && (
                <p className="mt-0.5 text-xs capitalize text-gray-400">{userRol}</p>
              )}
            </div>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>

          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <Link
                  href="/configuracion/perfil"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <UserCircle className="h-4 w-4" /> Mi perfil
                </Link>
                <Link
                  href="/configuracion/usuarios"
                  onClick={() => setMenu(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4" /> Usuarios
                </Link>
                <hr className="my-1 border-gray-100 dark:border-gray-700" />
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
