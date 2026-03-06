export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { PrintButton } from '@/components/print/PrintButton'

interface PageProps { params: Promise<{ id: string }> }

async function getEmpresa() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('empresas')
    .select('nombre, nit, dv, razon_social, direccion, ciudad, departamento, telefono, email, regimen')
    .limit(1).single()
  return data
}

export default async function PrintNotaCreditoPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: nc }, empresa] = await Promise.all([
    supabase.from('documentos').select(`
      id, numero, prefijo, fecha, subtotal, total_iva, total_descuento, total, motivo, observaciones,
      cliente:cliente_id(razon_social, numero_documento, tipo_documento, email, telefono, direccion),
      factura_origen:documento_origen_id(numero, prefijo, fecha),
      lineas:documentos_lineas(
        id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, total_iva, total,
        producto:producto_id(codigo),
        impuesto:impuesto_id(porcentaje)
      )
    `).eq('id', id).eq('tipo', 'nota_credito').single(),
    getEmpresa(),
  ])

  if (!nc) notFound()

  const cliente = nc.cliente as { razon_social?: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string; direccion?: string } | null
  const origen  = nc.factura_origen as { numero?: number; prefijo?: string; fecha?: string } | null
  const lineas  = (nc.lineas as any[]) ?? []

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-gray-100 border-b border-gray-200">
        <PrintButton />
        <a href={`/ventas/notas-credito/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Volver</a>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 print:px-6 print:py-4 print:max-w-none">

        {/* Encabezado empresa */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-800">
          <div>
            <h1 className="text-xl font-bold text-gray-900 uppercase">{empresa?.nombre ?? 'EMPRESA'}</h1>
            {empresa?.razon_social && empresa.razon_social !== empresa.nombre && (
              <p className="text-sm text-gray-600">{empresa.razon_social}</p>
            )}
            <p className="text-sm text-gray-600 mt-1">NIT: {empresa?.nit ?? '—'}{empresa?.dv ? `-${empresa.dv}` : ''}</p>
            {empresa?.direccion && <p className="text-xs text-gray-500 mt-1">{empresa.direccion}</p>}
            {empresa?.ciudad && <p className="text-xs text-gray-500">{empresa.ciudad}{empresa.departamento ? `, ${empresa.departamento}` : ''}</p>}
            {empresa?.telefono && <p className="text-xs text-gray-500">Tel: {empresa.telefono}</p>}
          </div>
          <div className="text-right border-2 border-gray-800 px-5 py-3 rounded">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Nota Crédito</p>
            <p className="text-2xl font-bold text-gray-900 font-mono mt-1">{nc.prefijo}{nc.numero}</p>
            <p className="text-xs text-gray-500 mt-1">{formatFecha(nc.fecha)}</p>
          </div>
        </div>

        {/* Factura origen */}
        {origen && (
          <div className="mb-4 rounded bg-gray-50 border border-gray-200 px-4 py-2 text-sm">
            <span className="font-medium text-gray-700">Nota crédito a factura: </span>
            <span className="font-mono font-bold">{origen.prefijo}{origen.numero}</span>
            <span className="text-gray-500 ml-2">({formatFecha(origen.fecha)})</span>
          </div>
        )}

        {/* Motivo */}
        {nc.motivo && (
          <div className="mb-6 rounded bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-700">
            <span className="font-medium">Motivo: </span>{nc.motivo}
          </div>
        )}

        {/* Cliente */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Cliente</p>
            <p className="font-bold text-gray-900">{cliente?.razon_social ?? 'CONSUMIDOR FINAL'}</p>
            {cliente?.tipo_documento && <p className="text-sm text-gray-600">{cliente.tipo_documento}: {cliente.numero_documento}</p>}
            {cliente?.email && <p className="text-sm text-gray-500">{cliente.email}</p>}
            {cliente?.telefono && <p className="text-sm text-gray-500">{cliente.telefono}</p>}
            {cliente?.direccion && <p className="text-sm text-gray-500">{cliente.direccion}</p>}
          </div>
        </div>

        {/* Líneas */}
        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-2 pr-4 text-gray-700 font-semibold">Descripción</th>
              <th className="text-right py-2 px-2 text-gray-700 font-semibold">Cant.</th>
              <th className="text-right py-2 px-2 text-gray-700 font-semibold">P. Unit.</th>
              <th className="text-right py-2 px-2 text-gray-700 font-semibold">Dcto%</th>
              <th className="text-right py-2 pl-2 text-gray-700 font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l: any) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="py-2 pr-4">
                  <p className="text-gray-900">{l.descripcion}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400">{l.producto.codigo}</p>}
                </td>
                <td className="text-right py-2 px-2 text-gray-700">{l.cantidad}</td>
                <td className="text-right py-2 px-2 font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                <td className="text-right py-2 px-2 text-gray-500">{l.descuento_porcentaje ?? 0}%</td>
                <td className="text-right py-2 pl-2 font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end mb-8">
          <div className="w-56">
            <div className="flex justify-between text-sm py-1 text-gray-600">
              <span>Subtotal</span><span className="font-mono">{formatCOP(nc.subtotal)}</span>
            </div>
            {nc.total_descuento > 0 && (
              <div className="flex justify-between text-sm py-1 text-gray-500">
                <span>Descuento</span><span className="font-mono">-{formatCOP(nc.total_descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm py-1 text-gray-600">
              <span>IVA</span><span className="font-mono">{formatCOP(nc.total_iva)}</span>
            </div>
            <div className="flex justify-between font-bold text-base border-t-2 border-gray-800 pt-2 mt-1">
              <span>TOTAL</span><span className="font-mono">{formatCOP(nc.total)}</span>
            </div>
          </div>
        </div>

        {/* Observaciones */}
        {nc.observaciones && (
          <p className="text-xs text-gray-500 border-t border-gray-200 pt-4">{nc.observaciones}</p>
        )}

        <p className="text-xs text-gray-400 mt-8 text-center print:block">
          Documento generado el {new Date().toLocaleDateString('es-CO')}
        </p>
      </div>
    </div>
  )
}
