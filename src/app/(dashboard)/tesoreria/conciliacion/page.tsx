export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Scale } from 'lucide-react'
import { ConciliacionBancaria } from '@/components/tesoreria/ConciliacionBancaria'

export default async function ConciliacionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const [{ data: cuentas }, { data: conciliaciones }] = await Promise.all([
    supabase
      .from('cuentas_bancarias')
      .select('id, nombre, banco, saldo_actual')
      .eq('empresa_id', session.empresa_id)
      .eq('activa', true)
      .order('nombre'),
    supabase
      .from('conciliaciones_bancarias')
      .select('*, cuenta:cuentas_bancarias(id,nombre,banco)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha_fin', { ascending: false }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Scale className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Conciliación Bancaria</h1>
          <p className="text-sm text-gray-500">Cruza movimientos del sistema con extractos bancarios</p>
        </div>
      </div>
      <ConciliacionBancaria cuentas={cuentas ?? []} conciliaciones={conciliaciones ?? []} />
    </div>
  )
}
