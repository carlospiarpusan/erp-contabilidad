export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getFormasPago } from '@/lib/db/maestros'
import { getUvtVigencias } from '@/lib/db/compliance'
import { getRetencionesActivas } from '@/lib/db/retenciones'
import { getFacturasCompraPendientesPago, getRecibosCompraContables } from '@/lib/db/compras'
import { Banknote } from 'lucide-react'
import { PagosProveedores } from '@/components/tesoreria/PagosProveedores'

export default async function PagosProveedoresPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const currentYear = new Date().getFullYear()
  const [pagos, formasPago, facturasPendientes, retenciones, uvtVigencias] = await Promise.all([
    getRecibosCompraContables({ limit: 100 }),
    getFormasPago(),
    getFacturasCompraPendientesPago({ limit: 200 }),
    getRetencionesActivas('compras'),
    getUvtVigencias(),
  ])
  const uvtValue = uvtVigencias.find((item) => item.año === currentYear)?.valor ?? null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <Banknote className="h-5 w-5 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pagos a Proveedores</h1>
          <p className="text-sm text-gray-500">Aplicación contable de pagos sobre facturas de compra pendientes</p>
        </div>
      </div>
      <PagosProveedores
        pagos={pagos}
        formasPago={formasPago}
        facturasPendientes={facturasPendientes}
        retenciones={retenciones}
        uvtValue={uvtValue}
      />
    </div>
  )
}
