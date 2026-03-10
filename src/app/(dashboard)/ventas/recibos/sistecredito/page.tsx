export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, CalendarCheck2, Lightbulb, Wallet } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { getFormasPagoRecaudoVentas, getSistecreditoPendientesPorMes } from '@/lib/db/ventas'
import { PagoMensualSistecredito } from '@/components/ventas/PagoMensualSistecredito'

export default async function RecibosSistecreditoPage() {
  const session = await getSession()
  if (!session || (session.rol !== 'admin' && session.rol !== 'contador')) {
    redirect('/ventas/recibos')
  }

  const [meses, formasPago] = await Promise.all([
    getSistecreditoPendientesPorMes(),
    getFormasPagoRecaudoVentas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/30">
            <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pago mensual Sistecrédito</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aplica el recaudo consolidado por mes y deja pagadas las facturas del período.
            </p>
          </div>
        </div>

        <Link
          href="/ventas/recibos"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800/70"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a recibos
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <CalendarCheck2 className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            Cómo funciona
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            La factura sigue emitida al cliente, pero la cuenta por cobrar queda a nombre de Sistecrédito.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-300" />
            Qué hace este cierre
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Crea un recibo por el saldo de cada factura pendiente del mes seleccionado, usando la cuenta de recaudo que elijas.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
            <Lightbulb className="h-4 w-4" />
            Sugeridos
          </div>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
            Compras &gt; Sugeridos usa ventas y stock. Este recaudo no cambia la demanda; solo cambia cartera y caja.
          </p>
          <Link
            href="/compras/sugeridos"
            className="mt-3 inline-flex items-center text-sm font-medium text-amber-900 hover:underline dark:text-amber-200"
          >
            Abrir sugeridos
          </Link>
        </div>
      </div>

      <PagoMensualSistecredito meses={meses} formasPago={formasPago} />
    </div>
  )
}
