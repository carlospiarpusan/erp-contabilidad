export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { FileSearch } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { PanelAuditoria } from '@/components/notificaciones/PanelAuditoria'

export default async function AuditoriaPage() {
  const session = await getSession()
  if (!session || session.rol !== 'admin') {
    redirect('/')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FileSearch className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Auditoría</h1>
          <p className="text-sm text-gray-500">Trazabilidad de cambios y operaciones críticas.</p>
        </div>
      </div>
      <PanelAuditoria />
    </div>
  )
}
