export const dynamic = 'force-dynamic'

import { getTiposGasto } from '@/lib/db/gastos'
import { ListaTiposGasto } from '@/components/gastos/ListaTiposGasto'
import { Tag } from 'lucide-react'

export default async function TiposGastoPage() {
  const tipos = await getTiposGasto()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Tag className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tipos de gasto</h1>
          <p className="text-sm text-gray-500">{tipos.length} categoría{tipos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <ListaTiposGasto tipos={tipos as unknown as Parameters<typeof ListaTiposGasto>[0]['tipos']} />
    </div>
  )
}
