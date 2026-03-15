'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { formatCOP, formatFecha, cardCls , cn } from '@/utils/cn'
import Link from 'next/link'
import { ShoppingCart, Truck, Warehouse, CheckCircle, XCircle, CreditCard, Printer } from 'lucide-react'

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

interface Compra {
  id: string; numero: number; prefijo: string; fecha: string
  numero_externo: string
  subtotal: number; total_iva: number; total_descuento: number; total: number
  estado: string; observaciones?: string | null
  proveedor?: { razon_social: string; numero_documento?: string; tipo_documento?: string; email?: string; telefono?: string } | null
  bodega?: { nombre: string } | null
  lineas?: Linea[]
  recibos?: Recibo[]
}

const BADGE: Record<string, 'success' | 'danger' | 'warning' | 'outline'> = {
  pendiente: 'warning', pagada: 'success', cancelada: 'danger',
}

interface Props { compra: Compra; formasPago: FormaPago[] }

export function DetalleCompra({ compra, formasPago }: Props) {
  const router = useRouter()
  const [modalPago, setModalPago]   = useState(false)
  const [cancelando, setCancelando] = useState(false)

  // Estado del form de pago
  const [fpId,   setFpId]   = useState(formasPago[0]?.id ?? '')
  const [valor,  setValor]  = useState(0)
  const [fecha,  setFecha]  = useState(new Date().toISOString().split('T')[0])
  const [obs,    setObs]    = useState('')
  const [pagando, setPagando] = useState(false)
  const [errPago, setErrPago] = useState('')

  const totalPagado = (compra.recibos ?? []).reduce((s, r) => s + r.valor, 0)
  const saldo       = compra.total - totalPagado
  const puedePagar  = compra.estado === 'pendiente' && saldo > 0.01

  function abrirPago() {
    setValor(Math.round(saldo * 100) / 100)
    setErrPago('')
    setModalPago(true)
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (valor <= 0) return setErrPago('Ingresa un valor válido')
    if (valor > saldo * 1.001) return setErrPago(`El valor no puede superar el saldo (${formatCOP(saldo)})`)
    setPagando(true)
    try {
      const res = await fetch(`/api/compras/facturas/${compra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'pagar', forma_pago_id: fpId, valor, fecha, observaciones: obs }),
      })
      const data = await res.json()
      if (!res.ok) return setErrPago(data.error ?? 'Error al registrar pago')
      setModalPago(false)
      router.refresh()
    } finally {
      setPagando(false)
    }
  }

  async function handleCancelar() {
    if (!confirm(`¿Cancelar la factura de compra ${compra.prefijo}${compra.numero}? Esta acción no se puede revertir.`)) return
    setCancelando(true)
    try {
      await fetch(`/api/compras/facturas/${compra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'cancelar' }),
      })
      router.refresh()
    } finally {
      setCancelando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
            <ShoppingCart className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">
                Compra {compra.prefijo}{compra.numero}
              </h1>
              <Badge variant={BADGE[compra.estado] ?? 'outline'}>
                {(compra.estado ?? '').charAt(0).toUpperCase() + (compra.estado ?? '').slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Fecha: {formatFecha(compra.fecha)} · Factura proveedor: <span className="font-mono">{compra.numero_externo}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {puedePagar && (
            <Button size="sm" onClick={abrirPago}>
              <CreditCard className="h-4 w-4 mr-1" /> Registrar pago
            </Button>
          )}
          {compra.estado === 'pendiente' && (
            <Button size="sm" variant="outline" onClick={handleCancelar} disabled={cancelando}>
              <XCircle className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          )}
          <Link href={`/print/compra/${compra.id}`} target="_blank">
            <Button size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Subtotal', value: formatCOP(compra.subtotal), color: 'text-gray-900 dark:text-gray-100' },
          { label: 'IVA',      value: formatCOP(compra.total_iva), color: 'text-gray-700 dark:text-gray-300' },
          { label: 'Total',    value: formatCOP(compra.total),    color: 'text-orange-700 text-xl' },
          { label: 'Saldo',    value: formatCOP(saldo),           color: saldo > 0 ? 'text-red-600' : 'text-green-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info proveedor */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className={`${cardCls} p-4`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-orange-500" /> Proveedor
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm">
              <dd className="font-medium text-gray-900">{compra.proveedor?.razon_social ?? '—'}</dd>
              {compra.proveedor?.numero_documento && (
                <dd className="text-gray-500">{compra.proveedor.tipo_documento} {compra.proveedor.numero_documento}</dd>
              )}
              {compra.proveedor?.email    && <dd className="text-gray-500">{compra.proveedor.email}</dd>}
              {compra.proveedor?.telefono && <dd className="text-gray-500">{compra.proveedor.telefono}</dd>}
            </dl>
          </div>
          <div className={`${cardCls} p-4`}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-gray-400" /> Recepción
            </h3>
            <dl className="flex flex-col gap-1.5 text-sm text-gray-600">
              {compra.bodega && <div className="flex justify-between"><dt>Bodega</dt><dd>{compra.bodega.nombre}</dd></div>}
              {compra.observaciones && <div className="mt-2 text-xs text-gray-400 italic">{compra.observaciones}</div>}
            </dl>
          </div>
        </div>

        {/* Líneas */}
        <div className={cn('lg:col-span-2', cardCls, 'p-5')}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Artículos recibidos</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Producto</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Cant.</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">P. Costo</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">IVA</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(compra.lineas ?? []).map(l => (
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
                  <td className="pt-2 text-right font-mono font-bold text-orange-700 text-base">{formatCOP(compra.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Pagos */}
      {(compra.recibos ?? []).length > 0 && (
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" /> Pagos realizados
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
              {(compra.recibos ?? []).map(r => (
                <tr key={r.id}>
                  <td className="py-2 font-mono text-sm text-gray-600">{r.numero}</td>
                  <td className="py-2 text-gray-700">{formatFecha(r.fecha)}</td>
                  <td className="py-2 text-gray-500">{(r.forma_pago as { descripcion?: string } | null)?.descripcion ?? '—'}</td>
                  <td className="py-2 text-right font-mono font-medium text-orange-700">{formatCOP(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal pago */}
      <Modal open={modalPago} onClose={() => setModalPago(false)} titulo="Registrar pago a proveedor" size="sm">
        <form onSubmit={handlePagar} className="flex flex-col gap-4">
          <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
            Saldo pendiente: <span className="font-bold">{formatCOP(saldo)}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Forma de pago</label>
            <select value={fpId} onChange={e => setFpId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.descripcion}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valor pagado *</label>
            <input type="number" min="0.01" step="0.01" value={valor}
              onChange={e => setValor(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
            <input value={obs} onChange={e => setObs(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          {errPago && <p className="text-sm text-red-600">{errPago}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalPago(false)}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={pagando}>{pagando ? 'Registrando…' : 'Registrar pago'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
