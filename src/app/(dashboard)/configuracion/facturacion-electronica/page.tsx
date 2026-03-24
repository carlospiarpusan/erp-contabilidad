export const dynamic = 'force-dynamic'

import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowRightLeft, ShieldCheck } from 'lucide-react'
import { cardCls } from '@/utils/cn'

export default async function FacturacionElectronicaPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div className={`${cardCls} border-amber-200 bg-amber-50 p-6`}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-700" />
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-bold text-amber-950">Facturación electrónica nativa desactivada</h1>
              <p className="mt-1 text-sm text-amber-900/80">
                ClovEnt no emite ni transmite facturación electrónica DIAN desde la plataforma.
                La operación fiscal debe resolverse con un proveedor tecnológico o una integración externa.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Link
                href="/configuracion/regulacion"
                className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-950 transition hover:border-amber-300 hover:bg-amber-100/40"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" /> Regulación y cumplimiento
                </span>
                <span className="mt-1 block text-amber-900/80">
                  Define si la empresa usa proveedor FE externo, documento soporte y exógena.
                </span>
              </Link>
              <Link
                href="/compras/facturas/importar"
                className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-950 transition hover:border-amber-300 hover:bg-amber-100/40"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <ArrowRightLeft className="h-4 w-4" /> Importar compras XML/ZIP/PDF
                </span>
                <span className="mt-1 block text-amber-900/80">
                  Conserva la automatización para compras sin prometer emisión fiscal propia.
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
