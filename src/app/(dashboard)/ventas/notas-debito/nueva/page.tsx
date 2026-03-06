export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FormNotaDebito } from '@/components/ventas/FormNotaDebito'
import { TrendingUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevaNotaDebitoPage() {
  const supabase = await createClient()
  const { data: impuestos } = await supabase
    .from('impuestos')
    .select('id, nombre, porcentaje')
    .eq('activo', true)
    .order('porcentaje')

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/ventas/notas-debito" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <TrendingUp className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Nota Débito</h1>
          <p className="text-sm text-gray-500">Cargo adicional al cliente</p>
        </div>
      </div>

      <FormNotaDebito impuestos={impuestos ?? []} />
    </div>
  )
}
