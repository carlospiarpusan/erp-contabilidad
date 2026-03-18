import { Zap } from 'lucide-react'
import { ImportarFacturaElectronica } from '@/components/compras/ImportarFacturaElectronica'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function ImportarFacturaElectronicaPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/compras/facturas" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Facturas de compra
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Zap className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Importar factura electrónica</h1>
          <p className="text-sm text-gray-500">Sube el XML, ZIP o PDF del proveedor y actualiza inventario automáticamente</p>
        </div>
      </div>

      <ImportarFacturaElectronica />
    </div>
  )
}
