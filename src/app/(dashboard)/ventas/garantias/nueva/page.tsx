export const dynamic = 'force-dynamic'

import { FormGarantia } from '@/components/garantias/FormGarantia'
import { ShieldCheck } from 'lucide-react'

export default async function NuevaGarantiaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Nueva Garantía</h1>
          <p className="text-sm text-gray-500">Registrar reclamación o devolución de cliente</p>
        </div>
      </div>
      <FormGarantia />
    </div>
  )
}
