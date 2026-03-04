export const dynamic = 'force-dynamic'

import { getImpuestosAll } from '@/lib/db/contabilidad'
import { GestionImpuestos } from '@/components/contabilidad/GestionImpuestos'
import { Percent } from 'lucide-react'

export default async function ImpuestosPage() {
  const impuestos = await getImpuestosAll()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <Percent className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Impuestos</h1>
          <p className="text-sm text-gray-500">{impuestos.length} impuesto{impuestos.length !== 1 ? 's' : ''} configurado{impuestos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <GestionImpuestos impuestos={impuestos} />
    </div>
  )
}
