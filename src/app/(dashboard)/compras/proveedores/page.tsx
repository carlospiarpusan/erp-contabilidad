export const dynamic = 'force-dynamic'

import { getProveedores } from '@/lib/db/compras'
import { ListaProveedores } from '@/components/compras/ListaProveedores'
import { Truck } from 'lucide-react'

export default async function ProveedoresPage() {
  const { proveedores, total } = await getProveedores({ limit: 200 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Truck className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
          <p className="text-sm text-gray-500">{total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <ListaProveedores proveedores={proveedores} total={total} />
    </div>
  )
}
