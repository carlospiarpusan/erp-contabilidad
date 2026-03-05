export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Warehouse } from 'lucide-react'
import { FormBodegas } from '@/components/configuracion/FormBodegas'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export default async function BodegasPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bodegas')
    .select('id, codigo, nombre, principal, activa')
    .eq('empresa_id', EMPRESA_ID)
    .order('nombre')

  const bodegas = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
          <Warehouse className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Bodegas</h1>
          <p className="text-sm text-gray-500">Gestión de almacenes y puntos de stock</p>
        </div>
      </div>

      <FormBodegas bodegas={bodegas} />
    </div>
  )
}
