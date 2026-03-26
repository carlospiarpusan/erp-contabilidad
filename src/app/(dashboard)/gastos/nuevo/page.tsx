export const dynamic = 'force-dynamic'

import { getAcreedores, getTiposGasto } from '@/lib/db/gastos'
import { getFormasPago } from '@/lib/db/maestros'
import { FormGasto } from '@/components/gastos/FormGasto'
import { getUvtVigencias } from '@/lib/db/compliance'
import { getRetencionesActivas } from '@/lib/db/retenciones'
import { Receipt, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevoGastoPage() {
  const [{ acreedores }, tiposGasto, formasPago, retenciones, uvts] = await Promise.all([
    getAcreedores({ activo: true }),
    getTiposGasto(),
    getFormasPago(),
    getRetencionesActivas('compras'),
    getUvtVigencias(),
  ])
  const currentYear = new Date().getFullYear()
  const uvtValue = uvts.find((item) => item.año === currentYear)?.valor ?? null

  return (
    <div className="flex flex-col gap-4">
      <Link href="/gastos" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ChevronLeft className="h-4 w-4" /> Volver a gastos
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600">
          <Receipt className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Registrar gasto</h2>
          <p className="text-sm text-gray-500">Registro de gastos operativos</p>
        </div>
      </div>
      <FormGasto acreedores={acreedores} tiposGasto={tiposGasto} formasPago={formasPago} retenciones={retenciones} uvtValue={uvtValue} />
    </div>
  )
}
