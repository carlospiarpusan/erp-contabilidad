export const dynamic = 'force-dynamic'

import { getAcreedores } from '@/lib/db/gastos'
import { ListaAcreedores } from '@/components/gastos/ListaAcreedores'
import { Users } from 'lucide-react'

export default async function AcreedoresPage() {
  const { acreedores, total } = await getAcreedores()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <Users className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Acreedores</h1>
          <p className="text-sm text-gray-500">{total} acreedor{total !== 1 ? 'es' : ''}</p>
        </div>
      </div>
      <ListaAcreedores acreedores={acreedores} total={total} />
    </div>
  )
}
