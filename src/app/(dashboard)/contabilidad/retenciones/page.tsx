export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Percent } from 'lucide-react'
import { GestionRetenciones } from '@/components/contabilidad/GestionRetenciones'

export default async function RetencionesPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('retenciones')
    .select('*')
    .eq('empresa_id', session.empresa_id)
    .order('tipo')
    .order('nombre')

  const retenciones = (data ?? []) as {
    id: string; tipo: string; nombre: string
    porcentaje: number; base_minima: number; base_uvt?: number | null
    aplica_a: string; activa: boolean
  }[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Percent className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Retenciones</h1>
          <p className="text-sm text-gray-500">
            Configuración de Retefuente, ReteICA y ReteIVA — {retenciones.length} retenci{retenciones.length !== 1 ? 'ones' : 'ón'}
          </p>
        </div>
      </div>
      <GestionRetenciones retenciones={retenciones} />
    </div>
  )
}
