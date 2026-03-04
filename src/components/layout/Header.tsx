'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut, User, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  titulo: string
  userEmail?: string
}

export function Header({ titulo, userEmail }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const hoy = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date())

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{titulo}</h1>
        <p className="text-xs text-gray-500 capitalize">{hoy}</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative rounded-full p-1.5 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>

        <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
            <User className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm text-gray-700">{userEmail ?? 'admon1'}</span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      </div>
    </header>
  )
}
