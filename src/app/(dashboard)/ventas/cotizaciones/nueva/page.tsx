export const dynamic = 'force-dynamic'

import { getClientes } from '@/lib/db/clientes'
import { getProductos, getImpuestos, getBodegas } from '@/lib/db/productos'
import { FormCotizacion } from '@/components/cotizaciones/FormCotizacion'
import { FileText } from 'lucide-react'

export default async function NuevaCotizacionPage() {
  const [{ clientes }, { productos }, impuestos, bodegas] = await Promise.all([
    getClientes({ activo: true, limit: 500 }),
    getProductos({ activo: true, limit: 500 }),
    getImpuestos(),
    getBodegas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <FileText className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Cotización</h1>
          <p className="text-sm text-gray-500">Propuesta de venta a cliente</p>
        </div>
      </div>

      <FormCotizacion
        clientes={clientes as unknown as Parameters<typeof FormCotizacion>[0]['clientes']}
        productos={productos as unknown as Parameters<typeof FormCotizacion>[0]['productos']}
        impuestos={impuestos as unknown as Parameters<typeof FormCotizacion>[0]['impuestos']}
        bodegas={bodegas as unknown as Parameters<typeof FormCotizacion>[0]['bodegas']}
      />
    </div>
  )
}
