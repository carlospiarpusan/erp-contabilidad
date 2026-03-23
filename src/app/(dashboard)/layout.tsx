export const dynamic = 'force-dynamic'

import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (session.debe_cambiar_password) redirect('/cambiar-password')

  return (
    <div className="clovent-grid flex h-screen overflow-hidden">
      <Sidebar rol={session.rol} empresaNombre={session.empresa_nombre} />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Header
          titulo="ClovEnt"
          userName={session.nombre}
          userEmail={session.email}
          userRol={session.rol}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(19,148,135,0.10),transparent_70%)]" />
        <main className="relative flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
