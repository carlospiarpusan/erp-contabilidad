import { getClientes, getGruposClientes } from '@/lib/db/clientes'
import { ListaClientes } from '@/components/clientes/ListaClientes'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; offset?: string }>
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const sp      = await searchParams
  const busqueda = sp.q ?? ''
  const offset   = parseInt(sp.offset ?? '0')
  const limit    = 50

  const [{ clientes, total }, grupos] = await Promise.all([
    getClientes({ busqueda, offset, limit }),
    getGruposClientes(),
  ])

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">Gestión de clientes y grupos</p>
        </div>
      </div>

      {/* Lista interactiva */}
      <ListaClientes
        clientes={clientes}
        total={total}
        grupos={grupos}
        busqueda={busqueda}
        offset={offset}
        limit={limit}
      />
    </div>
  )
}
