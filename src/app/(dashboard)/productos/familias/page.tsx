export const dynamic = 'force-dynamic'

import { getFamilias } from '@/lib/db/productos'
import { Familias } from '@/components/productos/Familias'
import { Tag } from 'lucide-react'

export default async function FamiliasPage() {
  const familias = await getFamilias()

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Tag className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Familias de productos</h1>
          <p className="text-sm text-gray-500">Categorías para organizar tu catálogo</p>
        </div>
      </div>
      <Familias familias={familias} />
    </div>
  )
}
