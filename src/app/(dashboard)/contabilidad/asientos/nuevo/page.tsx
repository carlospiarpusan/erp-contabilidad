export const dynamic = 'force-dynamic'

import { ChevronLeft, NotebookPen } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FormAsientoManual } from '@/components/contabilidad/FormAsientoManual'

export default async function NuevoAsientoManualPage() {
  const supabase = await createClient()
  const { data: cuentas } = await supabase
    .from('cuentas_puc')
    .select('id, codigo, descripcion')
    .eq('activa', true)
    .order('codigo')

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contabilidad/asientos" className="inline-flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Volver a asientos
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <NotebookPen className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nuevo asiento manual</h1>
          <p className="text-sm text-gray-500">Registra un asiento contable de partida doble.</p>
        </div>
      </div>

      <FormAsientoManual cuentas={(cuentas ?? []) as { id: string; codigo: string; descripcion: string }[]} />
    </div>
  )
}
