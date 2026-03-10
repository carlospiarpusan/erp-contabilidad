export const dynamic = 'force-dynamic'

import { ChevronLeft, FolderPlus } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FormCuentaPUC } from '@/components/contabilidad/FormCuentaPUC'

export default async function NuevaCuentaPUCPage() {
  const supabase = await createClient()
  const { data: cuentasPadre } = await supabase
    .from('cuentas_puc')
    .select('id, codigo, descripcion')
    .eq('activa', true)
    .order('codigo')

  return (
    <div className="flex flex-col gap-5">
      <Link href="/contabilidad/cuentas" className="inline-flex w-fit items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" /> Volver a cuentas
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FolderPlus className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Nueva cuenta PUC</h1>
          <p className="text-sm text-gray-500">Crea una cuenta para el plan contable de tu empresa.</p>
        </div>
      </div>
      <FormCuentaPUC cuentasPadre={(cuentasPadre ?? []) as { id: string; codigo: string; descripcion: string }[]} />
    </div>
  )
}
