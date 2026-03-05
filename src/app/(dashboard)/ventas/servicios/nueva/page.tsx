export const dynamic = 'force-dynamic'

import { getClientes } from '@/lib/db/clientes'
import { FormServicio } from '@/components/servicios/FormServicio'
import { Wrench } from 'lucide-react'

export default async function NuevoServicioPage() {
  const { clientes } = await getClientes({ activo: true, limit: 500 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Wrench className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Orden de Servicio</h1>
          <p className="text-sm text-gray-500">Registro de reparación o servicio técnico</p>
        </div>
      </div>
      <FormServicio clientes={clientes as any} />
    </div>
  )
}
