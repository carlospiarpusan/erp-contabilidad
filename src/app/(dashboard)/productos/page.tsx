import { getProductos, getFamilias, getFabricantes, getImpuestos } from '@/lib/db/productos'
import { ListaProductos } from '@/components/productos/ListaProductos'
import { Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string; familia_id?: string; offset?: string }>
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const sp         = await searchParams
  const busqueda   = sp.q ?? ''
  const familia_id = sp.familia_id
  const offset     = parseInt(sp.offset ?? '0')
  const limit      = 50

  const [{ productos, total }, familias, fabricantes, impuestos] = await Promise.all([
    getProductos({ busqueda, familia_id, offset, limit }),
    getFamilias(),
    getFabricantes(),
    getImpuestos(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500">
          <Package className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Artículos / Productos</h2>
          <p className="text-sm text-gray-500">Inventario, precios y variantes</p>
        </div>
      </div>

      <ListaProductos
        productos={productos}
        total={total}
        familias={familias}
        fabricantes={fabricantes}
        impuestos={impuestos}
        busqueda={busqueda}
        offset={offset}
        limit={limit}
      />
    </div>
  )
}
