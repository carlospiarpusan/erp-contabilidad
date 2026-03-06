export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { Warehouse } from 'lucide-react'
import { FormBodegas } from '@/components/configuracion/FormBodegas'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function BodegasPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('bodegas')
    .select('id, codigo, nombre, principal, activa')
    .eq('empresa_id', session.empresa_id)
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
