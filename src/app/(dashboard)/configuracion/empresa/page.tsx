export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { FormEmpresa } from '@/components/configuracion/FormEmpresa'
import { Building2 } from 'lucide-react'

async function getEmpresa() {
  const supabase = await createClient()
  const { data } = await supabase.from('empresas').select('*').limit(1).single()
  return data
}

export default async function EmpresaPage() {
  const empresa = await getEmpresa()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Building2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Datos de Empresa</h1>
          <p className="text-sm text-gray-500">Información que aparece en facturas y documentos</p>
        </div>
      </div>

      <FormEmpresa empresa={empresa as Parameters<typeof FormEmpresa>[0]['empresa']} />
    </div>
  )
}
