export const dynamic = 'force-dynamic'

import { BellRing } from 'lucide-react'
import { PanelNotificaciones } from '@/components/notificaciones/PanelNotificaciones'

export default function NotificacionesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <BellRing className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notificaciones</h1>
          <p className="text-sm text-gray-500">Alertas de stock, vencimientos y eventos del sistema.</p>
        </div>
      </div>
      <PanelNotificaciones />
    </div>
  )
}
