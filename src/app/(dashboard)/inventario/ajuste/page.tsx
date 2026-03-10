export const dynamic = 'force-dynamic'

import { getBodegas } from '@/lib/db/productos'
import { AjusteInventarioForm } from '@/components/inventario/AjusteInventarioForm'
import Link from 'next/link'
import { ChevronLeft, Package } from 'lucide-react'

export default async function AjusteInventarioPage() {
  const bodegas = await getBodegas()

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/productos" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Productos
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Package className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Ajuste de inventario</h1>
          <p className="text-sm text-gray-500">Corrije el stock de productos manualmente</p>
        </div>
      </div>

      <AjusteInventarioForm bodegas={bodegas} />
    </div>
  )
}
