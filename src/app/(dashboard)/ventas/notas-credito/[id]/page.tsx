export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { RotateCcw, Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NotaCreditoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: nc } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, subtotal, total_iva, total_descuento, total,
      estado, motivo, observaciones, documento_origen_id,
      cliente:cliente_id(razon_social, numero_documento, tipo_documento, email, telefono, direccion),
      factura_origen:documento_origen_id(id, numero, prefijo, fecha),
      lineas:documentos_lineas(
        id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, total_iva, total,
        producto:producto_id(codigo, descripcion),
        impuesto:impuesto_id(porcentaje)
      )
    `)
    .eq('id', id)
    .eq('tipo', 'nota_credito')
    .single()

  if (!nc) notFound()

  const cliente = nc.cliente as { razon_social?: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string; direccion?: string } | null
  const origen  = nc.factura_origen as { id?: string; numero?: number; prefijo?: string; fecha?: string } | null
  const lineas  = (nc.lineas as any[]) ?? []

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/ventas/notas-credito" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
            <RotateCcw className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Nota Crédito {nc.prefijo}{nc.numero}
            </h1>
            <p className="text-sm text-gray-500">{formatFecha(nc.fecha)}</p>
          </div>
        </div>
        <Link href={`/print/nota-credito/${nc.id}`} target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
          <Printer className="h-4 w-4" /> Imprimir
        </Link>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Cliente */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <p className="text-xs font-medium text-gray-500 mb-2">CLIENTE</p>
          <p className="font-semibold text-gray-900 dark:text-white">{cliente?.razon_social ?? '—'}</p>
          <p className="text-sm text-gray-500">{cliente?.tipo_documento} {cliente?.numero_documento}</p>
          {cliente?.email && <p className="text-sm text-gray-500 mt-1">{cliente.email}</p>}
          {cliente?.telefono && <p className="text-sm text-gray-500">{cliente.telefono}</p>}
        </div>

        {/* Factura origen */}
        <div className="rounded-xl border border-rose-100 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10 p-5">
          <p className="text-xs font-medium text-rose-600 mb-2">FACTURA DE ORIGEN</p>
          {origen ? (
            <>
              <Link href={`/ventas/facturas/${origen.id}`}
                className="font-semibold text-rose-700 hover:underline font-mono">
                {origen.prefijo}{origen.numero}
              </Link>
              <p className="text-sm text-rose-600">{origen.fecha ? formatFecha(origen.fecha) : '—'}</p>
            </>
          ) : <p className="text-gray-400">—</p>}
          <p className="text-xs text-rose-600 mt-2 font-medium">Motivo:</p>
          <p className="text-sm text-rose-700">{nc.motivo ?? '—'}</p>
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Cant.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">P. Unit.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">IVA%</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lineas.map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 dark:text-white">{l.descripcion}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400">{l.producto.codigo}</p>}
                </td>
                <td className="px-4 py-3 text-right">{l.cantidad}</td>
                <td className="px-4 py-3 text-right font-mono">{formatCOP(l.precio_unitario)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                <td className="px-4 py-3 text-right font-mono font-medium">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-64 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-mono">{formatCOP(nc.subtotal)}</span>
          </div>
          {nc.total_descuento > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Descuento</span>
              <span className="font-mono">-{formatCOP(nc.total_descuento)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>IVA</span>
            <span className="font-mono">{formatCOP(nc.total_iva)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2 text-rose-700">
            <span>Total devuelto</span>
            <span className="font-mono">{formatCOP(nc.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
