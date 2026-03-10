export const dynamic = 'force-dynamic'

import { getFormasPagoAll } from '@/lib/db/contabilidad'
import { getCuentasPUC } from '@/lib/db/contabilidad'
import { GestionFormasPago } from '@/components/contabilidad/GestionFormasPago'
import { CreditCard } from 'lucide-react'

export default async function FormasPagoPage() {
  const [formasPago, { cuentas }] = await Promise.all([
    getFormasPagoAll(),
    getCuentasPUC({ nivel: 4 }),
  ])
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
          <CreditCard className="h-5 w-5 text-indigo-600" />
        </div>
      <div>
          <h1 className="text-xl font-bold text-gray-900">Formas de pago</h1>
          <p className="text-sm text-gray-500">{formasPago.length} forma{formasPago.length !== 1 ? 's' : ''} configurada{formasPago.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <GestionFormasPago
        formasPago={formasPago as unknown as Parameters<typeof GestionFormasPago>[0]['formasPago']}
        cuentas={cuentas as unknown as Parameters<typeof GestionFormasPago>[0]['cuentas']}
      />
    </div>
  )
}
