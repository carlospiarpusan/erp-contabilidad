export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getReciboById } from '@/lib/db/ventas'
import { createClient } from '@/lib/supabase/server'
import { formatCOP, formatFecha } from '@/utils/cn'
import { PrintButton } from '@/components/print/PrintButton'

interface PageProps { params: Promise<{ id: string }> }

async function getEmpresa() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('empresas')
    .select('nombre, nit, dv, razon_social, direccion, ciudad, departamento, telefono, email')
    .limit(1).single()
  return data
}

export default async function PrintReciboCajaPage({ params }: PageProps) {
  const { id } = await params
  const [recibo, empresa] = await Promise.all([
    getReciboById(id).catch(() => null),
    getEmpresa(),
  ])

  if (!recibo) notFound()

  type ReciboData = {
    numero: number; fecha: string; valor: number; observaciones?: string | null
    documento?: { id?: string; numero?: number; prefijo?: string; total?: number; fecha?: string;
      cliente?: { razon_social?: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string } | null
    } | null
    forma_pago?: { descripcion?: string } | null
  }

  const r = recibo as unknown as ReciboData
  const doc     = r.documento ?? null
  const cliente = doc?.cliente ?? null
  const fp      = r.forma_pago ?? null

  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden flex items-center gap-3 px-6 py-3 bg-gray-100 border-b border-gray-200">
        <PrintButton />
        <a href={`/ventas/recibos/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Volver</a>
      </div>

      <div className="max-w-lg mx-auto px-8 py-8 print:px-6 print:py-4 print:max-w-none">

        {/* Encabezado empresa */}
        <div className="text-center mb-6 pb-4 border-b-2 border-gray-800">
          <h1 className="text-lg font-bold text-gray-900 uppercase">{empresa?.nombre ?? 'EMPRESA'}</h1>
          {empresa?.razon_social && empresa.razon_social !== empresa.nombre && (
            <p className="text-sm text-gray-600">{empresa.razon_social}</p>
          )}
          <p className="text-sm text-gray-600">NIT: {empresa?.nit ?? '—'}{empresa?.dv ? `-${empresa.dv}` : ''}</p>
          {empresa?.ciudad && <p className="text-xs text-gray-500">{empresa.ciudad}{empresa.departamento ? `, ${empresa.departamento}` : ''}</p>}
          {empresa?.telefono && <p className="text-xs text-gray-500">Tel: {empresa.telefono}</p>}
        </div>

        {/* Título y número */}
        <div className="text-center mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recibo de Caja</p>
          <p className="text-3xl font-bold text-gray-900 font-mono">N° {r.numero}</p>
          <p className="text-sm text-gray-500 mt-1">{formatFecha(r.fecha)}</p>
        </div>

        {/* Cliente */}
        {cliente && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Recibí de</p>
            <p className="font-bold text-gray-900 text-base">{cliente.razon_social ?? '—'}</p>
            {cliente.numero_documento && (
              <p className="text-sm text-gray-600">{cliente.tipo_documento ?? 'CC'}: {cliente.numero_documento}</p>
            )}
            {cliente.telefono && <p className="text-sm text-gray-500">Tel: {cliente.telefono}</p>}
          </div>
        )}

        {/* Valor principal */}
        <div className="my-6 p-5 border-2 border-gray-800 rounded-lg text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">La suma de</p>
          <p className="text-4xl font-bold font-mono text-gray-900">{formatCOP(r.valor)}</p>
          <p className="text-sm text-gray-500 mt-1">{fp?.descripcion ?? 'Efectivo'}</p>
        </div>

        {/* Concepto / Factura relacionada */}
        {doc?.numero && (
          <div className="mb-6 text-sm">
            <p className="text-gray-600">
              <strong>Concepto:</strong> Pago factura{' '}
              <span className="font-mono font-bold">{doc.prefijo}{doc.numero}</span>
              {doc.fecha ? ` del ${formatFecha(doc.fecha)}` : ''}
              {doc.total ? ` — Total: ${formatCOP(doc.total)}` : ''}
            </p>
          </div>
        )}

        {r.observaciones && (
          <p className="text-sm text-gray-500 italic mb-6">{r.observaciones}</p>
        )}

        {/* Firma */}
        <div className="grid grid-cols-2 gap-12 mt-12 pt-4 border-t border-gray-200 text-xs text-center text-gray-400">
          <div>
            <div className="border-b border-gray-300 mb-1 pb-6"></div>
            <p>Firma quien recibe</p>
          </div>
          <div>
            <div className="border-b border-gray-300 mb-1 pb-6"></div>
            <p>Firma quien paga</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          {empresa?.nombre} · {new Date().toLocaleDateString('es-CO')}
        </p>
      </div>
    </div>
  )
}
