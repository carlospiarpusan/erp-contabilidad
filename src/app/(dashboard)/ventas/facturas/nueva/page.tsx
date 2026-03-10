export const dynamic = 'force-dynamic'

import { getImpuestos, getBodegas } from '@/lib/db/productos'
import { getFormasPago, getColaboradores } from '@/lib/db/maestros'
import { FormFactura } from '@/components/ventas/FormFactura'
import { TrendingUp, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevaFacturaPage() {
  const [impuestos, bodegas, formasPago, colaboradores] = await Promise.all([
    getImpuestos(),
    getBodegas(),
    getFormasPago(),
    getColaboradores(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <Link href="/ventas/facturas" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a facturas
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nueva factura de venta</h2>
          <p className="text-sm text-gray-500">Completa los datos y agrega los artículos</p>
        </div>
      </div>

      <FormFactura
        impuestos={impuestos}
        bodegas={bodegas}
        formasPago={formasPago}
        colaboradores={colaboradores}
      />
    </div>
  )
}
