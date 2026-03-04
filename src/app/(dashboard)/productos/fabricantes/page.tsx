export const dynamic = 'force-dynamic'

import { getFabricantes } from '@/lib/db/productos'
import { Fabricantes } from '@/components/productos/Fabricantes'
import { Factory } from 'lucide-react'

export default async function FabricantesPage() {
  const fabricantes = await getFabricantes()

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Factory className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fabricantes / Marcas</h1>
          <p className="text-sm text-gray-500">Marcas y fabricantes de tus productos</p>
        </div>
      </div>
      <Fabricantes fabricantes={fabricantes} />
    </div>
  )
}
