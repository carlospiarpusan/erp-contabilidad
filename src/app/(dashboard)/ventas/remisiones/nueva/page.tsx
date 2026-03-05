export const dynamic = 'force-dynamic'

import { getClientes } from '@/lib/db/clientes'
import { getProductos, getImpuestos, getBodegas } from '@/lib/db/productos'
import { FormRemision } from '@/components/remisiones/FormRemision'
import { Truck } from 'lucide-react'

export default async function NuevaRemisionPage() {
  const [{ clientes }, { productos }, impuestos, bodegas] = await Promise.all([
    getClientes({ activo: true, limit: 500 }),
    getProductos({ activo: true, limit: 500 }),
    getImpuestos(),
    getBodegas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
          <Truck className="h-5 w-5 text-cyan-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Remisión</h1>
          <p className="text-sm text-gray-500">Documento de despacho de mercancía</p>
        </div>
      </div>

      <FormRemision
        clientes={clientes as never}
        productos={productos as never}
        impuestos={impuestos as never}
        bodegas={bodegas as never}
      />
    </div>
  )
}
