export const dynamic = 'force-dynamic'

import { getProveedores } from '@/lib/db/compras'
import { ListaProveedores } from '@/components/compras/ListaProveedores'
import { Truck, Upload } from 'lucide-react'
import Link from 'next/link'

export default async function ProveedoresPage() {
  const { proveedores, total } = await getProveedores({ limit: 200 })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
            <Truck className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
            <p className="text-sm text-gray-500">{total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link
          href="/configuracion/importar?entidad=proveedores"
          className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700 hover:bg-orange-100 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Migrar / Importar
        </Link>
      </div>

      <ListaProveedores proveedores={proveedores} total={total} />
    </div>
  )
}
