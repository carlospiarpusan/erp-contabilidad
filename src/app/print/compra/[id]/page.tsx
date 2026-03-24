export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getCompraById } from '@/lib/db/compras'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { PrintButton } from '@/components/print/PrintButton'

interface PageProps { params: Promise<{ id: string }> }

async function getEmpresa() {
  const supabase = await createClient()
  const { data } = await supabase.from('empresas').select('nombre, nit, dv, razon_social, direccion, ciudad, telefono').limit(1).single()
  return data
}

export default async function PrintCompraPage({ params }: PageProps) {
  const { id } = await params
  const [compra, empresa] = await Promise.all([
    getCompraById(id).catch(() => null),
    getEmpresa(),
  ])
  if (!compra) notFound()

  const lineas = (compra.lineas ?? []) as unknown as {
    id: string; descripcion?: string | null; cantidad: number
    precio_unitario: number; descuento_porcentaje: number; total: number
    producto?: { codigo: string; descripcion: string } | null
    impuesto?: { porcentaje: number } | null
  }[]

  const proveedor = compra.proveedor as { razon_social?: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string } | null

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-gray-100 border-b border-gray-200">
        <PrintButton />
        <a href={`/compras/facturas/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Volver</a>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 print:px-6 print:py-4 print:max-w-none">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase">{empresa?.nombre ?? 'EMPRESA'}</h1>
            <p className="text-sm text-gray-600 mt-1">NIT: {empresa?.nit ?? '—'}{empresa?.dv ? `-${empresa.dv}` : ''}</p>
            <p className="text-sm text-gray-500">{empresa?.direccion ?? ''}{empresa?.ciudad ? ` — ${empresa.ciudad}` : ''}</p>
            {empresa?.telefono && <p className="text-sm text-gray-500">Tel: {empresa.telefono}</p>}
          </div>
          <div className="text-right">
            <div className="border-2 border-orange-700 px-4 py-2 rounded">
              <p className="text-xs font-medium text-orange-600 uppercase">Factura de Compra</p>
              <p className="text-2xl font-bold text-gray-900 font-mono">{compra.prefijo}{compra.numero}</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">Fecha: <strong>{formatFecha(compra.fecha)}</strong></p>
            <p className="text-sm text-gray-500">F. Proveedor: <span className="font-mono">{compra.numero_externo}</span></p>
          </div>
        </div>

        {/* Proveedor */}
        <div className="mb-6 p-4 bg-orange-50 rounded-lg">
          <p className="text-xs font-semibold text-orange-600 uppercase mb-2">Proveedor</p>
          <p className="font-bold text-gray-900">{proveedor?.razon_social ?? '—'}</p>
          {proveedor?.numero_documento && (
            <p className="text-sm text-gray-600">{proveedor.tipo_documento ?? 'NIT'}: {proveedor.numero_documento}</p>
          )}
          {proveedor?.email && <p className="text-sm text-gray-600">{proveedor.email}</p>}
        </div>

        {/* Líneas */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="pb-2 text-left font-semibold text-gray-700">Descripción</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">Cant.</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">P. Costo</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">IVA%</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.id ?? i} className="border-b border-gray-100">
                <td className="py-2">
                  <p className="text-gray-900">{l.descripcion ?? l.producto?.descripcion ?? '—'}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                </td>
                <td className="py-2 text-right text-gray-700">{l.cantidad}</td>
                <td className="py-2 text-right font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                <td className="py-2 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                <td className="py-2 text-right font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end mb-8">
          <div className="w-56">
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">{formatCOP(compra.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">IVA</span>
              <span className="font-mono">{formatCOP(compra.total_iva)}</span>
            </div>
            <div className="flex justify-between font-bold py-2 border-t-2 border-gray-800 mt-1">
              <span>TOTAL</span>
              <span className="font-mono">{formatCOP(compra.total)}</span>
            </div>
          </div>
        </div>

        {compra.observaciones && (
          <p className="text-sm text-gray-500 italic mb-6">{compra.observaciones}</p>
        )}

        <p className="text-center text-xs text-gray-400 mt-8 border-t border-gray-100 pt-4">
          Generado por ClovEnt · {empresa?.nombre} · {new Date().toLocaleDateString('es-CO')}
        </p>
      </div>
    </div>
  )
}
