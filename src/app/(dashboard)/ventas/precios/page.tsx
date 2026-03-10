export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getGruposClientes } from '@/lib/db/clientes'
import { GestorPrecios } from '@/components/precios/GestorPrecios'
import { Tag } from 'lucide-react'

export default async function ListaPreciosPage() {
  const supabase = await createClient()

  const [{ data: precios }, grupos] = await Promise.all([
    supabase
      .from('listas_precios')
      .select('*, producto:producto_id(codigo, descripcion), cliente:cliente_id(razon_social), grupo:grupo_id(nombre)')
      .order('nombre'),
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
        precios={(precios ?? []) as any}
        grupos={grupos.map((g: any) => ({ id: g.id, nombre: g.nombre }))}
      />
    </div>
  )
}
