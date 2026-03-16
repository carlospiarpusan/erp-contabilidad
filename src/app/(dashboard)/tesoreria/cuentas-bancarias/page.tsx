export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Building2 } from 'lucide-react'
import { CuentasBancarias } from '@/components/tesoreria/CuentasBancarias'

export default async function CuentasBancariasPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()
  const { data } = await supabase
    .from('cuentas_bancarias')
    .select('*')
    .eq('empresa_id', session.empresa_id)
    .order('nombre')

  const cuentas = (data ?? []) as {
    id: string; nombre: string; banco: string; tipo_cuenta: string
    numero_cuenta: string; titular?: string | null
    saldo_inicial: number; saldo_actual: number; activa: boolean
  }[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Cuentas Bancarias</h1>
          <p className="text-sm text-gray-500">Gestión de cuentas de banco y movimientos</p>
        </div>
      </div>
      <CuentasBancarias cuentas={cuentas} />
    </div>
  )
}
