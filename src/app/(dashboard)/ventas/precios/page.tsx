export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getProductos } from '@/lib/db/productos'
import { getClientes, getGruposClientes } from '@/lib/db/clientes'
import { GestorPrecios } from '@/components/precios/GestorPrecios'
import { Tag } from 'lucide-react'

export default async function ListaPreciosPage() {
  const supabase = await createClient()

  const [{ data: precios }, { productos }, { clientes }, grupos] = await Promise.all([
    supabase
      .from('listas_precios')
      .select('*, producto:producto_id(codigo, descripcion), cliente:cliente_id(razon_social), grupo:grupo_id(nombre)')
      .order('nombre'),
    getProductos({ activo: true, limit: 500 }),
    getClientes({ activo: true, limit: 500 }),
    getGruposClientes(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Tag className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Listas de Precios</h1>
          <p className="text-sm text-gray-500">Precios especiales por producto, cliente o grupo</p>
        </div>
      </div>

      <GestorPrecios
        precios={(precios ?? []) as never}
        productos={productos.map(p => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion }))}
        clientes={clientes.map(c => ({ id: c.id, razon_social: c.razon_social }))}
        grupos={grupos.map((g: never) => ({ id: g.id, nombre: g.nombre }))}
      />
    </div>
  )
}
