export const dynamic = 'force-dynamic'

import { getGastoById } from '@/lib/db/gastos'
import { notFound } from 'next/navigation'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Receipt, CreditCard, User, FileText } from 'lucide-react'
import Link from 'next/link'

interface Props { params: Promise<{ id: string }> }

export default async function DetalleGastoPage({ params }: Props) {
  const { id } = await params
  const gasto = await getGastoById(id).catch(() => null)

  if (!gasto) notFound()

  const acreedor  = gasto.acreedor  as { razon_social?: string; email?: string; telefono?: string } | null
  const formaPago = gasto.forma_pago as { descripcion?: string } | null
  const lineas    = (gasto.lineas ?? []) as { id: string; descripcion?: string | null; precio_unitario: number; total: number }[]

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/gastos" className="hover:text-gray-700">← Gastos</Link>
      </div>

      {/* Encabezado */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
            <Receipt className="h-6 w-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Gasto {gasto.prefijo}{gasto.numero}</h1>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Fecha: {formatFecha(gasto.fecha)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-purple-700">{formatCOP(gasto.total)}</p>
            <p className="text-sm text-gray-500 mt-0.5">{formaPago?.descripcion ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Acreedor */}
      {acreedor && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Acreedor
          </p>
          <p className="font-semibold text-gray-900">{acreedor.razon_social ?? '—'}</p>
          {acreedor.email    && <p className="text-sm text-gray-500 mt-0.5">{acreedor.email}</p>}
          {acreedor.telefono && <p className="text-sm text-gray-500">Tel: {acreedor.telefono}</p>}
        </div>
      )}

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-4 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" /> Detalle del gasto
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="pb-2 text-left font-medium text-gray-500">Descripción</th>
              <th className="pb-2 text-right font-medium text-gray-500 w-28">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lineas.length === 0 ? (
              <tr><td colSpan={2} className="py-4 text-center text-gray-400 text-xs">Sin líneas</td></tr>
            ) : lineas.map((l, i) => (
              <tr key={l.id ?? i}>
                <td className="py-2 text-gray-800">{l.descripcion ?? '—'}</td>
                <td className="py-2 text-right font-mono text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td className="pt-2 font-bold text-gray-900">Total</td>
              <td className="pt-2 text-right font-mono font-bold text-purple-700">{formatCOP(gasto.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pago */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> Forma de pago
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Método</dt>
            <dd className="font-medium text-gray-900">{formaPago?.descripcion ?? '—'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Valor total</dt>
            <dd className="font-mono font-bold text-purple-700 text-base">{formatCOP(gasto.total)}</dd>
          </div>
          {gasto.observaciones && (
            <div className="flex justify-between py-1">
              <dt className="text-gray-500">Observaciones</dt>
              <dd className="text-gray-700 text-right max-w-xs">{gasto.observaciones}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
