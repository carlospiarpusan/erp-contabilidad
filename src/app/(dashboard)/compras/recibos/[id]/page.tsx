export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import { Receipt, CreditCard, FileText, Building2, Printer } from 'lucide-react'
import Link from 'next/link'

interface PageProps { params: Promise<{ id: string }> }

type ProveedorRecibo = {
  razon_social?: string
  numero_documento?: string
  tipo_documento?: string
  email?: string
  telefono?: string
}

type DocumentoReciboCompra = {
  id?: string
  numero?: number
  prefijo?: string
  total?: number
  fecha?: string
  proveedor?: ProveedorRecibo | null
}

type ReciboCompraDetalle = {
  numero: number
  fecha: string
  valor: number
  observaciones?: string | null
  documento?: DocumentoReciboCompra | null
  forma_pago?: { descripcion?: string } | null
}

async function getReciboCompraById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recibos')
    .select(`
      *,
      documento:documentos(id, numero, prefijo, total, fecha,
        proveedor:proveedores(razon_social, numero_documento, tipo_documento, email, telefono)
      ),
      forma_pago:formas_pago(id, descripcion)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export default async function DetalleReciboCompraPage({ params }: PageProps) {
  const { id } = await params
  const recibo = await getReciboCompraById(id).catch(() => null)

  if (!recibo) notFound()

  const detalle = recibo as ReciboCompraDetalle
  const doc = detalle.documento ?? null
  const fp = detalle.forma_pago ?? null
  const proveedor = doc?.proveedor ?? null

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/compras/recibos" className="hover:text-gray-700">← Recibos de compra</Link>
        </div>
        <Link href={`/print/recibo-compra/${id}`} target="_blank"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50">
          <Printer className="h-4 w-4" /> Imprimir
        </Link>
      </div>

      {/* Encabezado */}
      <div className={cn(cardCls, 'p-6')}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
            <Receipt className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Recibo de Compra N° {detalle.numero}</h1>
              <span className="rounded-full bg-orange-100 px-3 py-0.5 text-xs font-medium text-orange-700">Registrado</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Fecha: {formatFecha(detalle.fecha)}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-mono text-orange-700">{formatCOP(detalle.valor)}</p>
            <p className="text-sm text-gray-500 mt-0.5">{fp?.descripcion ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Proveedor */}
      {proveedor && (
        <div className={cn(cardCls, 'p-5')}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Proveedor
          </p>
          <p className="font-semibold text-gray-900">{proveedor.razon_social ?? '—'}</p>
          {proveedor.numero_documento && <p className="text-sm text-gray-500">{proveedor.tipo_documento ?? 'NIT'}: {proveedor.numero_documento}</p>}
          {proveedor.email    && <p className="text-sm text-gray-500">{proveedor.email}</p>}
          {proveedor.telefono && <p className="text-sm text-gray-500">Tel: {proveedor.telefono}</p>}
        </div>
      )}

      {/* Factura relacionada */}
      {doc?.id && (
        <div className={cn(cardCls, 'p-5')}>
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Factura de compra
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
              <Link href={`/compras/facturas/${doc.id}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                Ver factura →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Detalle pago */}
      <div className={cn(cardCls, 'p-5')}>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5" /> Detalle del pago
        </p>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Forma de pago</dt>
            <dd className="font-medium text-gray-900">{fp?.descripcion ?? '—'}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Valor pagado</dt>
            <dd className="font-mono font-bold text-orange-700 text-base">{formatCOP(detalle.valor)}</dd>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-50">
            <dt className="text-gray-500">Fecha de pago</dt>
            <dd className="text-gray-900">{formatFecha(detalle.fecha)}</dd>
          </div>
          {detalle.observaciones && (
            <div className="flex justify-between py-1">
              <dt className="text-gray-500">Observaciones</dt>
              <dd className="text-gray-700 text-right max-w-xs">{detalle.observaciones}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
