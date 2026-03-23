export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getPedidoById } from '@/lib/db/pedidos'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { PrintButton } from '@/components/print/PrintButton'
import { QRDocumento } from '@/components/print/QRDocumento'
import { headers } from 'next/headers'

interface PageProps { params: Promise<{ id: string }> }

type LineaImpresion = {
  id: string
  descripcion?: string | null
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  subtotal: number
  total_iva: number
  total: number
  producto?: { codigo?: string; descripcion?: string } | null
  impuesto?: { porcentaje?: number } | null
}

type ClienteImpresion = {
  razon_social?: string
  numero_documento?: string
  tipo_documento?: string
  email?: string
  telefono?: string
}

type DocumentoImpresion = {
  prefijo?: string
  numero?: number
  fecha: string
  fecha_vencimiento?: string
  estado?: string
  subtotal?: number
  total_descuento?: number
  total_iva?: number
  total?: number
  observaciones?: string
  lineas?: LineaImpresion[]
  cliente?: ClienteImpresion | null
  bodega?: { nombre?: string } | null
}

async function getEmpresa() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('empresas')
    .select('nombre, nit, dv, razon_social, direccion, ciudad, departamento, telefono, email, regimen')
    .limit(1).single()
  return data
}

export default async function PrintPedidoPage({ params }: PageProps) {
  const { id } = await params
  const [pedido, empresa] = await Promise.all([
    getPedidoById(id).catch(() => null),
    getEmpresa(),
  ])

  if (!pedido) notFound()

  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  const docUrl = `${proto}://${host}/ventas/pedidos/${id}`

  const doc = pedido as DocumentoImpresion
  const lineas = doc.lineas ?? []
  const cliente = doc.cliente ?? null
  const bodega = doc.bodega ?? null

  const ESTADO_LABEL: Record<string, string> = {
    pendiente: 'Pendiente', en_proceso: 'En proceso',
    despachado: 'Despachado', facturado: 'Facturado', cancelado: 'Cancelado',
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-gray-100 border-b border-gray-200">
        <PrintButton />
        <a href={`/ventas/pedidos/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Volver</a>
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
            <p className="text-sm text-gray-500">
              {empresa?.direccion ?? ''}{empresa?.ciudad ? ` — ${empresa.ciudad}` : ''}{empresa?.departamento ? `, ${empresa.departamento}` : ''}
            </p>
            {empresa?.telefono && <p className="text-sm text-gray-500">Tel: {empresa.telefono}</p>}
            {empresa?.email    && <p className="text-sm text-gray-500">{empresa.email}</p>}
            {empresa?.regimen  && <p className="text-xs text-gray-400 mt-1 uppercase">Régimen {empresa.regimen}</p>}
          </div>
          <div className="text-right">
            <div className="border-2 border-gray-800 px-4 py-2 rounded">
              <p className="text-xs font-medium text-gray-500 uppercase">Pedido</p>
              <p className="text-2xl font-bold text-gray-900 font-mono">{doc.prefijo}{doc.numero}</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">Fecha: <strong>{formatFecha(doc.fecha)}</strong></p>
            {doc.fecha_vencimiento && (
              <p className="text-sm text-gray-600">Entrega: <strong>{formatFecha(doc.fecha_vencimiento)}</strong></p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Estado: {ESTADO_LABEL[doc.estado ?? ''] ?? doc.estado}
            </p>
            {bodega?.nombre && <p className="text-xs text-gray-400">Bodega: {bodega.nombre}</p>}
          </div>
        </div>

        {/* Datos cliente */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cliente</p>
          <p className="font-bold text-gray-900">{cliente?.razon_social ?? '—'}</p>
          {cliente?.numero_documento && (
            <p className="text-sm text-gray-600">{cliente.tipo_documento ?? 'CC'}: {cliente.numero_documento}</p>
          )}
          {cliente?.email    && <p className="text-sm text-gray-600">{cliente.email}</p>}
          {cliente?.telefono && <p className="text-sm text-gray-600">Tel: {cliente.telefono}</p>}
        </div>

        {/* Líneas */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="pb-2 text-left font-semibold text-gray-700">Descripción</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">Cant.</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">P. Unit.</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">Dcto%</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">IVA%</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => (
              <tr key={l.id ?? i} className="border-b border-gray-100">
                <td className="py-2">
                  <p className="text-gray-900">{l.producto?.descripcion ?? l.descripcion ?? '—'}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                </td>
                <td className="py-2 text-right text-gray-700">{l.cantidad}</td>
                <td className="py-2 text-right font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                <td className="py-2 text-right text-gray-500">{l.descuento_porcentaje > 0 ? `${l.descuento_porcentaje}%` : '—'}</td>
                <td className="py-2 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                <td className="py-2 text-right font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totales */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">{formatCOP(doc.subtotal ?? 0)}</span>
            </div>
            {(doc.total_descuento ?? 0) > 0 && (
              <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-600">Descuento</span>
                <span className="font-mono text-red-600">-{formatCOP(doc.total_descuento ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
              <span className="text-gray-600">IVA</span>
              <span className="font-mono">{formatCOP(doc.total_iva ?? 0)}</span>
            </div>
            <div className="flex justify-between text-base font-bold py-2 border-t-2 border-gray-800 mt-1">
              <span>TOTAL</span>
              <span className="font-mono">{formatCOP(doc.total ?? 0)}</span>
            </div>
          </div>
        </div>

        {doc.observaciones && (
          <div className="mb-6 text-sm">
            <p className="font-semibold text-gray-700 mb-1">Observaciones:</p>
            <p className="text-gray-500 italic">{doc.observaciones}</p>
          </div>
        )}

        {/* Firmas + QR */}
        <div className="grid grid-cols-3 gap-8 mt-12 pt-6 border-t border-gray-200 text-xs text-center text-gray-400">
          <div>
            <div className="border-b border-gray-300 mb-1 pb-4"></div>
            <p>Firma despachador</p>
          </div>
          <div>
            <div className="border-b border-gray-300 mb-1 pb-4"></div>
            <p>Firma cliente / recibí conforme</p>
          </div>
          <div className="flex justify-center">
            <QRDocumento url={docUrl} size={72} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Generado por ClovEnt · {empresa?.nombre} · {new Date().toLocaleDateString('es-CO')}
        </p>
      </div>
    </div>
  )
}
