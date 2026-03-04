export const dynamic = 'force-dynamic'

import { getGruposConConteo } from '@/lib/db/clientes'
import { GruposClientes } from '@/components/clientes/GruposClientes'
import { Tag } from 'lucide-react'

export default async function GruposPage() {
  const grupos = await getGruposConConteo()

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Tag className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Grupos de clientes</h1>
          <p className="text-sm text-gray-500">Segmenta clientes para descuentos y condiciones especiales</p>
        </div>
      </div>
      <GruposClientes grupos={grupos} />
    </div>
  )
}
