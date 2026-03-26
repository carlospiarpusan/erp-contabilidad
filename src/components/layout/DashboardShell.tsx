'use client'

import { MobileLayoutProvider, useMobileLayout } from '@/components/layout/MobileLayoutProvider'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import type { AppRole } from '@/lib/auth/permissions'

interface DashboardShellProps {
  children: React.ReactNode
  rol: AppRole
  empresaNombre?: string
  userName?: string
  userEmail?: string
}

function ShellInner({ children, rol, empresaNombre, userName, userEmail }: DashboardShellProps) {
  const { isMobile, sidebarOpen, closeSidebar } = useMobileLayout()

  return (
    <div className="clovent-grid flex h-screen overflow-hidden">
      {/* Sidebar: static on desktop, drawer on mobile */}
      {isMobile ? (
        <>
          {/* Backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
              onClick={closeSidebar}
            />
          )}
          {/* Drawer */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-[272px] transition-transform duration-300 ease-in-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <Sidebar rol={rol} empresaNombre={empresaNombre} onNavigate={closeSidebar} />
          </aside>
        </>
      ) : (
        <Sidebar rol={rol} empresaNombre={empresaNombre} />
      )}

      {/* Main content */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header
          titulo="ClovEnt"
          userName={userName}
          userEmail={userEmail}
          userRol={rol}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(19,148,135,0.10),transparent_70%)]" />
        <main className="relative flex-1 overflow-y-auto px-6 py-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav: mobile only */}
      {isMobile && <BottomNav />}
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
