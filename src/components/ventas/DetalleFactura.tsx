'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormRecibo } from './FormRecibo'
import { formatCOP, formatFecha, cardCls } from '@/utils/cn'
import Link from 'next/link'
import { FileText, User, CreditCard, Warehouse, CheckCircle, Printer, MessageCircle } from 'lucide-react'
import { EnviarEmailButton } from '@/components/shared/EnviarEmailButton'
import { DuplicarButton } from '@/components/shared/DuplicarButton'
import { calcularFechaPagoSistecredito, isSistecreditoFormaPago } from '@/lib/utils/formas-pago'

interface FormaPago { id: string; descripcion: string }

interface Recibo {
  id: string; numero: number; valor: number; fecha: string
  observaciones?: string | null
  forma_pago?: { descripcion: string } | null
}

interface Linea {
  id: string; descripcion?: string; cantidad: number
  precio_unitario: number; descuento_porcentaje: number
  subtotal: number; total_iva: number; total: number
  producto?: { codigo: string; descripcion: string } | null
  impuesto?: { porcentaje: number } | null
}

interface Factura {
  id: string; numero: number; prefijo: string; fecha: string
  fecha_vencimiento?: string | null
  subtotal: number; total_iva: number; total_descuento: number; total: number
  estado: string; observaciones?: string | null
  dian_estado?: string | null
  cufe?: string | null
  qr_url?: string | null
  cliente?: { razon_social: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string } | null
  forma_pago?: { descripcion: string; tipo: string } | null
  bodega?: { nombre: string } | null
  colaborador?: { nombre: string } | null
  lineas?: Linea[]
  recibos?: Recibo[]
}

const BADGE: Record<string, 'success' | 'danger' | 'warning' | 'outline'> = {
  pendiente: 'warning', pagada: 'success', cancelada: 'danger', vencida: 'danger',
}

interface Props {
  factura:    Factura
  formasPago: FormaPago[]
}

export function DetalleFactura({ factura, formasPago }: Props) {
  const router = useRouter()
  const [modalRecibo, setModalRecibo] = useState(false)

  const totalPagado = (factura.recibos ?? []).reduce((s, r) => s + r.valor, 0)
  const saldo       = factura.total - totalPagado
  const puedePagar  = factura.estado === 'pendiente' && saldo > 0.01
  const esSistecredito = isSistecreditoFormaPago(factura.forma_pago)
  const fechaCobroEsperada = esSistecredito ? calcularFechaPagoSistecredito(factura.fecha) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                Factura {factura.prefijo}{factura.numero}
              </h1>
              <Badge variant={BADGE[factura.estado] ?? 'outline'}>
                {(factura.estado ?? '').charAt(0).toUpperCase() + (factura.estado ?? '').slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Fecha: {formatFecha(factura.fecha)}
              {factura.fecha_vencimiento && ` · Vence: ${formatFecha(factura.fecha_vencimiento)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedePagar && (
            <Button size="sm" onClick={() => setModalRecibo(true)}>
              <CreditCard className="h-4 w-4 mr-1" /> Registrar pago
            </Button>
          )}
          <EnviarEmailButton
            apiPath="/api/email/factura"
            docId={factura.id}
            emailCliente={factura.cliente?.email}
          />
          {factura.cliente?.telefono && (
            <a
              href={`https://wa.me/${factura.cliente.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola! Te compartimos tu factura ${factura.prefijo}${factura.numero} por ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(factura.total)}. Gracias por tu compra.`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline">
                <MessageCircle className="h-4 w-4 mr-1 text-green-600" /> WhatsApp
              </Button>
            </a>
          )}
          <DuplicarButton documentoId={factura.id} tipo="factura_venta" />
          <Link href={`/print/factura/${factura.id}`} target="_blank">
            <Button size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs saldo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Subtotal',   value: formatCOP(factura.subtotal), color: 'text-gray-900 dark:text-gray-100' },
          { label: 'IVA',        value: formatCOP(factura.total_iva), color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Total',      value: formatCOP(factura.total),    color: 'text-blue-700 text-xl' },
          { label: 'Saldo',      value: formatCOP(saldo),            color: saldo > 0 ? 'text-orange-600' : 'text-green-700' },
        ].map(k => (
          <div key={k.label} className={`${cardCls} p-4`}>
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info cliente + factura */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className={`${cardCls} p-4`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" /> Cliente
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm">
              <dd className="font-medium text-gray-900">{factura.cliente?.razon_social ?? '—'}</dd>
              {factura.cliente?.numero_documento && (
                <dd className="text-gray-500">{factura.cliente.tipo_documento} {factura.cliente.numero_documento}</dd>
              )}
              {factura.cliente?.email    && <dd className="text-gray-500">{factura.cliente.email}</dd>}
              {factura.cliente?.telefono && <dd className="text-gray-500">{factura.cliente.telefono}</dd>}
            </dl>
          </div>
          <div className={`${cardCls} p-4`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-gray-400" /> Datos de despacho
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm text-gray-600">
              {factura.forma_pago && <div className="flex justify-between"><dt>Forma de pago</dt><dd>{factura.forma_pago.descripcion}</dd></div>}
              {fechaCobroEsperada && <div className="flex justify-between"><dt>Cobro esperado</dt><dd>{formatFecha(fechaCobroEsperada)}</dd></div>}
              {factura.bodega     && <div className="flex justify-between"><dt>Bodega</dt><dd>{factura.bodega.nombre}</dd></div>}
              {factura.colaborador && <div className="flex justify-between"><dt>Vendedor</dt><dd>{factura.colaborador.nombre}</dd></div>}
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Las facturas contabilizadas no se cancelan en línea. Si hubo un error, corrígelo con nota crédito y la regularización de recaudos que aplique.
              </div>
              {factura.observaciones && <div className="mt-2 text-xs text-gray-400 italic">{factura.observaciones}</div>}
            </dl>
          </div>
        </div>

        {/* Líneas */}
        <div className={`lg:col-span-2 ${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Artículos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Producto</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">P. Unit.</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">IVA</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(factura.lineas ?? []).map(l => (
                  <tr key={l.id}>
                    <td className="py-2">
                      <p className="font-medium text-gray-900">{l.producto?.descripcion ?? l.descripcion ?? '—'}</p>
                      {l.producto?.codigo && <p className="text-xs text-gray-400 font-mono">{l.producto.codigo}</p>}
                    </td>
                    <td className="py-2 text-right text-gray-700">{l.cantidad}</td>
                    <td className="py-2 text-right font-mono text-gray-700">{formatCOP(l.precio_unitario)}</td>
                    <td className="py-2 text-right text-gray-500">{l.impuesto?.porcentaje ?? 0}%</td>
                    <td className="py-2 text-right font-mono font-medium text-gray-900">{formatCOP(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={4} className="pt-2 text-right text-sm font-bold text-gray-900">TOTAL</td>
                  <td className="pt-2 text-right font-mono font-bold text-blue-700 text-base">{formatCOP(factura.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Recibos */}
      {(factura.recibos ?? []).length > 0 && (
        <div className={`${cardCls} p-5`}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" /> Pagos registrados
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-500">N° Recibo</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500">Forma de pago</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(factura.recibos ?? []).map(r => (
                <tr key={r.id}>
                  <td className="py-2 font-mono text-sm text-gray-600">{r.numero}</td>
                  <td className="py-2 text-gray-700">{formatFecha(r.fecha)}</td>
                  <td className="py-2 text-gray-500">{(r.forma_pago as { descripcion?: string } | null)?.descripcion ?? '—'}</td>
                  <td className="py-2 text-right font-mono font-medium text-green-700">{formatCOP(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal recibo */}
      <Modal open={modalRecibo} onClose={() => setModalRecibo(false)} titulo="Registrar pago" size="sm">
        <FormRecibo
          documentoId={factura.id}
          totalFactura={factura.total}
          totalPagado={totalPagado}
          formasPago={formasPago}
          onDone={() => { setModalRecibo(false); router.refresh() }}
          onCancel={() => setModalRecibo(false)}
        />
      </Modal>
    </div>
  )
}
