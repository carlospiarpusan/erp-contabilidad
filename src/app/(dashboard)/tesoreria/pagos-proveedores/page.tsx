export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { Banknote } from 'lucide-react'
import { PagosProveedores } from '@/components/tesoreria/PagosProveedores'

export default async function PagosProveedoresPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const supabase = await createClient()

  const [{ data: pagos }, { data: cuentas }, { data: formasPago }] = await Promise.all([
    supabase
      .from('pagos_proveedores')
      .select('*, proveedor:proveedores(id,razon_social,numero_documento), cuenta:cuentas_bancarias(id,nombre,banco), forma_pago:formas_pago(id,nombre)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha', { ascending: false })
      .limit(100),
    supabase
      .from('cuentas_bancarias')
      .select('id, nombre, banco')
      .eq('empresa_id', session.empresa_id)
      .eq('activa', true)
      .order('nombre'),
    supabase
      .from('formas_pago')
      .select('id, nombre')
      .eq('empresa_id', session.empresa_id)
      .order('nombre'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Banknote className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pagos a Proveedores</h1>
          <p className="text-sm text-gray-500">Registro y seguimiento de pagos realizados</p>
        </div>
      </div>
      <PagosProveedores pagos={pagos ?? []} cuentas={cuentas ?? []} formasPago={formasPago ?? []} />
    </div>
  )
}
