export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ArrowLeftRight } from 'lucide-react'
import Link from 'next/link'
import { FormTraslado } from '@/components/inventario/FormTraslado'

const ROLES = new Set(['admin', 'contador'])

export default async function NuevoTrasladoPage() {
  const session = await getSession()
  if (!session || !ROLES.has(session.rol)) redirect('/')

  const supabase = await createClient()
  const { data: bodegas } = await supabase
    .from('bodegas')
    .select('id, nombre')
    .eq('empresa_id', session.empresa_id)
    .order('nombre')

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/inventario/traslados" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Traslados
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <ArrowLeftRight className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Nuevo Traslado</h1>
          <p className="text-sm text-gray-500">Selecciona bodegas y productos a trasladar</p>
        </div>
      </div>

      <FormTraslado bodegas={bodegas ?? []} />
    </div>
  )
}
