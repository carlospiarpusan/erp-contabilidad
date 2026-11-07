'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { MobileLayoutProvider, useMobileLayout } from '@/components/layout/MobileLayoutProvider'
import { Sidebar, type EmpresaAcceso } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import type { AppRole } from '@/lib/auth/permissions'

interface DashboardShellProps {
  children: React.ReactNode
  rol: AppRole
  empresaNombre?: string
  userName?: string
  userEmail?: string
  tieneMultiEmpresa?: boolean
  empresas?: EmpresaAcceso[]
}

function ShellInner({
  children,
  rol,
  empresaNombre,
  userName,
  userEmail,
  tieneMultiEmpresa,
  empresas,
}: DashboardShellProps) {
  const { isMobile, sidebarOpen, closeSidebar } = useMobileLayout()
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  // Título de la pestaña a partir del encabezado principal de cada página,
  // para distinguir pestañas y que los lectores de pantalla anuncien la página.
  useEffect(() => {
    const main = mainRef.current
    if (!main) return
    const aplicar = () => {
      const texto = main.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()
      if (!texto) return false
      const titulo = `${texto} | ClovEnt`
      if (document.title !== titulo) document.title = titulo
      return true
    }
    aplicar()
    const observer = new MutationObserver(() => { aplicar() })
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    if (!isMobile && sidebarOpen) closeSidebar()
  }, [closeSidebar, isMobile, sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeSidebar, sidebarOpen])

  return (
    <div className="app-shell-height clovent-grid flex overflow-hidden">
      <a
        href="#contenido-principal"
        onClick={(event) => {
          event.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-teal-700 focus:shadow-lg focus:ring-2 focus:ring-teal-500 dark:focus:bg-gray-900 dark:focus:text-teal-300"
      >
        Saltar al contenido
      </a>
      <div className="hidden md:flex">
        <Sidebar
          rol={rol}
          empresaNombre={empresaNombre}
          tieneMultiEmpresa={tieneMultiEmpresa}
          empresas={empresas}
        />
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm transition-opacity duration-200 md:hidden ${
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeSidebar}
      />

      <aside
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[272px] transition-transform duration-300 ease-in-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={closeSidebar}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/85 text-gray-500 shadow-sm backdrop-blur transition-colors hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900/85 dark:text-gray-300 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <Sidebar
          rol={rol}
          empresaNombre={empresaNombre}
          tieneMultiEmpresa={tieneMultiEmpresa}
          empresas={empresas}
          onNavigate={closeSidebar}
        />
      </aside>

      {/* Main content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header
          userName={userName}
          userEmail={userEmail}
          userRol={rol}
          tieneMultiEmpresa={tieneMultiEmpresa}
        />
        <main
          ref={mainRef}
          id="contenido-principal"
          tabIndex={-1}
          className="relative flex-1 overflow-y-auto focus:outline-none px-4 py-4 pb-24 sm:px-6 sm:py-6 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav: mobile only */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <MobileLayoutProvider>
      <ShellInner {...props} />
    </MobileLayoutProvider>
  )
}
