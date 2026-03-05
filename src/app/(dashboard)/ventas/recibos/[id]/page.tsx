export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getReciboById } from '@/lib/db/ventas'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Receipt, CreditCard, FileText, User } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

export default async function DetalleReciboCajaPage({ params }: PageProps) {
  const { id } = await params
  const recibo = await getReciboById(id).catch(() => null)

  if (!recibo) notFound()

  const doc     = (recibo as any).documento as { id?: string; numero?: number; prefijo?: string; total?: number; fecha?: string; cliente?: { razon_social?: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string } | null } | null
  const fp      = (recibo as any).forma_pago as { descripcion?: string } | null
  const cliente = doc?.cliente ?? null

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/ventas/recibos" className="hover:text-gray-700">← Recibos de caja</Link>
      </div>

      {/* Encabezado */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
            <Receipt className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Recibo N° {(recibo as any).numero}</h1>
              <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">Registrado</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Fecha: {formatFecha((recibo as any).fecha)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-green-700">{formatCOP((recibo as any).valor)}</p>
            <p className="text-sm text-gray-500 mt-0.5">{fp?.descripcion ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Cliente */}
      {cliente && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Cliente
          </p>
          <p className="font-semibold text-gray-900">{cliente.razon_social ?? '—'}</p>
          {cliente.numero_documento && <p className="text-sm text-gray-500">{cliente.tipo_documento ?? 'CC'}: {cliente.numero_documento}</p>}
          {cliente.email    && <p className="text-sm text-gray-500">{cliente.email}</p>}
          {cliente.telefono && <p className="text-sm text-gray-500">Tel: {cliente.telefono}</p>}
        </div>
      )}

      {/* Factura relacionada */}
      {doc?.id && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Factura de venta
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono font-semibold text-blue-700">{doc.prefijo}{doc.numero}</p>
              {doc.fecha && <p className="text-sm text-gray-500">Fecha: {formatFecha(doc.fecha)}</p>}
            </div>
            <div className="text-right">
              {doc.total !== undefined && (
                <p className="text-sm text-gray-600">Total factura: <span className="font-mono font-medium">{formatCOP(doc.total)}</span></p>
              )}
              <Link href={`/ventas/facturas/${doc.id}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                Ver factura →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Detalle pago */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> Detalle del pago
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Forma de pago</dt>
            <dd className="font-medium text-gray-900">{fp?.descripcion ?? '—'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Valor recibido</dt>
            <dd className="font-mono font-bold text-green-700 text-base">{formatCOP((recibo as any).valor)}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Fecha de pago</dt>
            <dd className="text-gray-900">{formatFecha((recibo as any).fecha)}</dd>
          </div>
          {(recibo as any).observaciones && (
            <div className="flex justify-between py-1">
              <dt className="text-gray-500">Observaciones</dt>
              <dd className="text-gray-700 text-right max-w-xs">{(recibo as any).observaciones}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
