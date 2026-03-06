export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession, puedeAcceder } from '@/lib/auth/session'

export default async function ContabilidadLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session || !puedeAcceder(session.rol, 'contabilidad')) {
    redirect('/')
  }
  return <>{children}</>
}
