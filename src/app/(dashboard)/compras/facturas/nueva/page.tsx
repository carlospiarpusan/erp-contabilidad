export const dynamic = 'force-dynamic'

import { getProveedores } from '@/lib/db/compras'
import { getProductos, getImpuestos, getBodegas } from '@/lib/db/productos'
import { FormCompra } from '@/components/compras/FormCompra'
import { ShoppingCart, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevaCompraPage() {
  const [{ proveedores }, { productos }, impuestos, bodegas] = await Promise.all([
    getProveedores({ activo: true, limit: 500 }),
    getProductos({ activo: true, limit: 500 }),
    getImpuestos(),
    getBodegas(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <Link href="/compras/facturas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a compras
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600">
          <ShoppingCart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nueva factura de compra</h2>
          <p className="text-sm text-gray-500">Registra una compra a proveedor</p>
        </div>
      </div>

      <FormCompra
        proveedores={proveedores}
        productos={productos}
        impuestos={impuestos}
        bodegas={bodegas}
      />
    </div>
  )
}
