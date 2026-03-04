export const dynamic = 'force-dynamic'

import { getConsecutivos } from '@/lib/db/contabilidad'
import { GestionConsecutivos } from '@/components/contabilidad/GestionConsecutivos'
import { Hash } from 'lucide-react'

export default async function ConsecutivosPage() {
  const consecutivos = await getConsecutivos()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
          <Hash className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Consecutivos</h1>
          <p className="text-sm text-gray-500">Numeración de documentos</p>
        </div>
      </div>
      <GestionConsecutivos consecutivos={consecutivos} />
    </div>
  )
}
