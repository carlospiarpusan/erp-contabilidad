export const dynamic = 'force-dynamic'

import { getProveedores } from '@/lib/db/compras'
import { getProductos, getImpuestos, getBodegas } from '@/lib/db/productos'
import { FormOrdenCompra } from '@/components/compras/FormOrdenCompra'
import { ShoppingCart } from 'lucide-react'

export default async function NuevaOrdenCompraPage() {
  const [{ proveedores }, { productos }, impuestos, bodegas] = await Promise.all([
    getProveedores({ activo: true, limit: 500, select_mode: 'selector', include_total: false }),
    getProductos({ activo: true, limit: 500, select_mode: 'selector', include_total: false }),
    getImpuestos(),
    getBodegas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <ShoppingCart className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Orden de Compra</h1>
          <p className="text-sm text-gray-500">Solicitud de productos a proveedor</p>
        </div>
      </div>

      <FormOrdenCompra
        proveedores={proveedores as unknown as Parameters<typeof FormOrdenCompra>[0]['proveedores']}
        productos={productos as unknown as Parameters<typeof FormOrdenCompra>[0]['productos']}
        impuestos={impuestos as unknown as Parameters<typeof FormOrdenCompra>[0]['impuestos']}
        bodegas={bodegas as unknown as Parameters<typeof FormOrdenCompra>[0]['bodegas']}
      />
    </div>
  )
}
