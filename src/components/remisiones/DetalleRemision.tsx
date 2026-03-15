'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCOP, formatFecha, cardCls } from '@/utils/cn'
import { Truck, Send, CheckCircle, XCircle, FileText, Printer, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { EnviarEmailButton } from '@/components/shared/EnviarEmailButton'

interface FormaPago { id: string; descripcion: string }
interface Linea {
  id: string; descripcion?: string; cantidad: number
  precio_unitario: number; descuento_porcentaje: number; total: number
  producto?: { codigo: string; descripcion: string } | null
  impuesto?: { porcentaje: number } | null
}
interface Remision {
  id: string; numero: number; prefijo: string; fecha: string; fecha_vencimiento?: string | null
  estado: string; subtotal: number; total_iva: number; total_descuento: number; total: number
  observaciones?: string | null
  cliente?: { id?: string; razon_social?: string; numero_documento?: string; email?: string; telefono?: string } | null
  bodega?: { nombre?: string } | null
  lineas?: Linea[]
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  borrador:  'outline',
  enviada:   'info',
  entregada: 'success',
  facturada: 'default',
  cancelada: 'danger',
}

interface Props { remision: Remision; formasPago: FormaPago[] }

export function DetalleRemision({ remision, formasPago }: Props) {
  const router = useRouter()
  const lineas = (remision.lineas ?? []) as Linea[]
  const [accionando, setAccionando] = useState(false)
  const [modalFact, setModalFact]   = useState(false)
  const [fpId, setFpId]             = useState(formasPago[0]?.id ?? '')
  const [vencimiento, setVenc]      = useState(remision.fecha)

  async function ejecutar(accion: string, extra?: object) {
    setAccionando(true)
    try {
      const res = await fetch(`/api/ventas/remisiones/${remision.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      if (accion === 'facturar' && data.id) {
        router.push(`/ventas/facturas/${data.id}`)
      } else {
        router.refresh()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setAccionando(false)
      setModalFact(false)
    }
  }

  const activo = !['facturada', 'cancelada'].includes(remision.estado)

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <Truck className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{remision.prefijo}{remision.numero}</h2>
                <Badge variant={BADGE_ESTADO[remision.estado] ?? 'outline'}>{remision.estado}</Badge>
              </div>
              <p className="text-sm text-gray-500">Fecha: {formatFecha(remision.fecha)}</p>
              {remision.fecha_vencimiento && (
                <p className="text-xs text-gray-400">Entrega: {formatFecha(remision.fecha_vencimiento)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {remision.estado === 'borrador' && (
              <Button size="sm" onClick={() => ejecutar('enviar')} disabled={accionando}>
                <Send className="h-4 w-4 mr-1" /> Marcar enviada
              </Button>
            )}
            {remision.estado === 'enviada' && (
              <Button size="sm" variant="success" onClick={() => ejecutar('entregar')} disabled={accionando}>
                <CheckCircle className="h-4 w-4 mr-1" /> Marcar entregada
              </Button>
            )}
            {(remision.estado === 'borrador' || remision.estado === 'enviada' || remision.estado === 'entregada') && (
              <Button size="sm" variant="success" onClick={() => setModalFact(true)} disabled={accionando}>
                <FileText className="h-4 w-4 mr-1" /> Facturar
              </Button>
            )}
            {activo && (
              <Button size="sm" variant="outline" onClick={() => ejecutar('cancelar')} disabled={accionando}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
            <EnviarEmailButton
              apiPath="/api/email/remision"
              docId={remision.id}
              emailCliente={remision.cliente?.email}
            />
            {remision.cliente?.telefono && (
              <a
                href={`https://wa.me/${remision.cliente.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola! Te informamos sobre la remisión ${remision.prefijo ?? ''}${remision.numero}. Gracias.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
              </a>
            )}
            <Link href={`/print/remision/${remision.id}`} target="_blank"
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <Printer className="h-4 w-4" /> Imprimir
            </Link>
          </div>
        </div>
      </div>

      {/* Cliente */}
      <div className={`${cardCls} p-5`}>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Cliente</p>
        <p className="font-semibold text-gray-900">{remision.cliente?.razon_social ?? '—'}</p>
        {remision.cliente?.numero_documento && <p className="text-sm text-gray-500">{remision.cliente.numero_documento}</p>}
        {remision.cliente?.email    && <p className="text-sm text-gray-500">{remision.cliente.email}</p>}
        {remision.cliente?.telefono && <p className="text-sm text-gray-500">{remision.cliente.telefono}</p>}
        {remision.bodega?.nombre && <p className="text-sm text-gray-400 mt-1">Bodega: {remision.bodega.nombre}</p>}
      </div>

      {/* Líneas */}
      <div className={`${cardCls} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Cant.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">IVA%</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineas.map((l, i) => (
              <tr key={l.id ?? i}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{l.producto?.descripcion ?? l.descripcion ?? '—'}</p>
                  {l.producto?.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{l.cantidad}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-56 flex flex-col gap-1 text-sm">
          <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-600">Subtotal</span><span className="font-mono">{formatCOP(remision.subtotal)}</span></div>
          {remision.total_descuento > 0 && <div className="flex justify-between py-1"><span className="text-red-600">Descuento</span><span className="font-mono text-red-600">-{formatCOP(remision.total_descuento)}</span></div>}
          <div className="flex justify-between py-1 border-b border-gray-100"><span className="text-gray-600">IVA</span><span className="font-mono">{formatCOP(remision.total_iva)}</span></div>
          <div className="flex justify-between font-bold py-2 border-t-2 border-gray-800 mt-1"><span>TOTAL</span><span className="font-mono text-cyan-700">{formatCOP(remision.total)}</span></div>
        </div>
      </div>

      {remision.observaciones && (
        <p className="text-sm text-gray-500 italic px-1">{remision.observaciones}</p>
      )}

      {/* Modal facturar */}
      <Modal open={modalFact} onClose={() => setModalFact(false)} titulo="Facturar Remisión">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">Selecciona forma de pago y vencimiento para crear la factura:</p>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Forma de pago *</label>
            <select value={fpId} onChange={e => setFpId(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500">
              {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.descripcion}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Fecha vencimiento</label>
            <input type="date" value={vencimiento} onChange={e => setVenc(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalFact(false)}>Cancelar</Button>
            <Button size="sm" disabled={accionando || !fpId}
              onClick={() => ejecutar('facturar', { forma_pago_id: fpId, vencimiento })}>
              {accionando ? 'Creando factura…' : 'Crear factura'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
