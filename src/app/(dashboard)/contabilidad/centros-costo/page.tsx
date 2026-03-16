export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { GestionCentrosCosto } from '@/components/contabilidad/GestionCentrosCosto'
import { Landmark } from 'lucide-react'

export default async function CentrosCostoPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data: centrosCosto } = await supabase
    .from('centros_costo')
    .select('*')
    .eq('empresa_id', session.empresa_id)
    .order('codigo')

  const lista = (centrosCosto ?? []) as {
    id: string
    codigo: string
    nombre: string
    descripcion?: string
    activo: boolean
  }[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Landmark className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Centros de Costo</h1>
          <p className="text-sm text-gray-500">
            {lista.length} centro{lista.length !== 1 ? 's' : ''} de costo configurado{lista.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <GestionCentrosCosto centrosCosto={lista} />
    </div>
  )
}
