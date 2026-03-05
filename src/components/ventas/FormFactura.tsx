'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

import type { Cliente, Producto, Impuesto, Bodega } from '@/types'
import { formatCOP } from '@/utils/cn'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

interface FormaPago { id: string; descripcion: string; tipo: string; dias_vencimiento: number }
interface Colaborador { id: string; nombre: string }

interface Linea {
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_id: string
  iva_pct: number
}

function calcLinea(l: Linea) {
  const subtotal = l.cantidad * l.precio_unitario
  const descuento = subtotal * (l.descuento_porcentaje / 100)
  const base = subtotal - descuento
  const iva = base * (l.iva_pct / 100)
  return { subtotal, descuento, iva, total: base + iva }
}

interface Props {
  clientes: Cliente[]
  productos: Producto[]
  impuestos: Impuesto[]
  bodegas: Bodega[]
  formasPago: FormaPago[]
  colaboradores: Colaborador[]
}

const hoy = new Date().toISOString().slice(0, 10)

export function FormFactura({ clientes, productos, impuestos, bodegas, formasPago, colaboradores }: Props) {
  const router = useRouter()

  // Cabecera
  const [cliente_id, setClienteId] = useState('')
  const [bodega_id, setBodegaId] = useState(bodegas.find(b => b.principal)?.id ?? bodegas[0]?.id ?? '')
  const [forma_pago_id, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [colaborador_id, setColaboradorId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [fecha_vencimiento, setVencimiento] = useState('')
  const [observaciones, setObs] = useState('')

  // Líneas
  const [lineas, setLineas] = useState<Linea[]>([])

  // UI
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Calcula vencimiento al cambiar forma de pago
  function handleFormaPago(id: string) {
    setFormaPagoId(id)
    const fp = formasPago.find(f => f.id === id)
    if (fp && fp.dias_vencimiento > 0) {
      const d = new Date(fecha)
      d.setDate(d.getDate() + fp.dias_vencimiento)
      setVencimiento(d.toISOString().slice(0, 10))
    } else {
      setVencimiento('')
    }
  }

  function agregarLinea() {
    const p0 = productos[0]
    const imp0 = impuestos.find(i => i.id === p0?.impuesto_id) ?? impuestos[0]
    setLineas(prev => [...prev, {
      producto_id: p0?.id ?? '',
      descripcion: p0?.descripcion ?? '',
      cantidad: 1,
      precio_unitario: p0?.precio_venta ?? 0,
      descuento_porcentaje: 0,
      impuesto_id: imp0?.id ?? '',
      iva_pct: imp0?.porcentaje ?? 0,
    }])
  }

  const handleProducto = useCallback((idx: number, producto_id: string) => {
    const p = productos.find(x => x.id === producto_id)
    const imp = impuestos.find(i => i.id === p?.impuesto_id)
    setLineas(prev => prev.map((l, i) => i !== idx ? l : {
      ...l,
      producto_id,
      descripcion: p?.descripcion ?? '',
      precio_unitario: p?.precio_venta ?? 0,
      impuesto_id: imp?.id ?? '',
      iva_pct: imp?.porcentaje ?? 0,
    }))
  }, [productos, impuestos])

  function updateLinea(idx: number, field: keyof Linea, value: string | number) {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: value }
      if (field === 'impuesto_id') {
        const imp = impuestos.find(x => x.id === value)
        updated.iva_pct = imp?.porcentaje ?? 0
      }
      return updated
    }))
  }

  function quitarLinea(idx: number) {
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

  // Totales
  const calcs = lineas.map(calcLinea)
  const subtotal = calcs.reduce((s, c) => s + c.subtotal, 0)
  const descuento = calcs.reduce((s, c) => s + c.descuento, 0)
  const totalIva = calcs.reduce((s, c) => s + c.iva, 0)
  const total = calcs.reduce((s, c) => s + c.total, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente_id) { setError('Selecciona un cliente'); return }
    if (!lineas.length) { setError('Agrega al menos un producto'); return }
    for (const l of lineas) {
      if (!l.producto_id) { setError('Selecciona un producto en todas las líneas'); return }
      if (l.cantidad <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    }

    setGuardando(true); setError('')
    try {
      const payload = {
        cliente_id, bodega_id, forma_pago_id,
        colaborador_id: colaborador_id || null,
        fecha, fecha_vencimiento: fecha_vencimiento || null,
        observaciones: observaciones || null,
        lineas: lineas.map(l => ({
          producto_id: l.producto_id,
          variante_id: null,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_porcentaje: l.descuento_porcentaje,
          impuesto_id: l.impuesto_id || null,
        })),
      }

      const res = await fetch('/api/ventas/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push(`/ventas/facturas/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Información general</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Cliente */}
          <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Cliente *</label>
            <select
              value={cliente_id}
              onChange={e => setClienteId(e.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.razon_social} {c.numero_documento ? `(${c.numero_documento})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Forma de pago */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Forma de pago *</label>
            <select
              value={forma_pago_id}
              onChange={e => handleFormaPago(e.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.descripcion}</option>)}
            </select>
          </div>

          {/* Bodega */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Bodega *</label>
            <select
              value={bodega_id}
              onChange={e => setBodegaId(e.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Vencimiento */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha vencimiento</label>
            <input
              type="date"
              value={fecha_vencimiento}
              onChange={e => setVencimiento(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Vendedor */}
          {colaboradores.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Vendedor</label>
              <select
                value={colaborador_id}
                onChange={e => setColaboradorId(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin vendedor</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}

          {/* Observaciones */}
          <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObs(e.target.value)}
              placeholder="Nota interna o para el cliente..."
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Artículos</h3>
          <Button type="button" size="sm" onClick={agregarLinea} disabled={productos.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Agregar línea
          </Button>
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">Agrega productos a la factura</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={agregarLinea}>
              <Plus className="h-4 w-4 mr-1" /> Agregar primer artículo
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 w-56">Producto</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500 w-20">Cant.</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500 w-28">Precio unit.</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500 w-20">Dcto %</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 w-28">IVA</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500 w-28">Total</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineas.map((l, idx) => {
                  const c = calcLinea(l)
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-2">
                        <select
                          value={l.producto_id}
                          onChange={e => handleProducto(idx, e.target.value)}
                          className="w-full h-8 rounded border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={l.cantidad}
                          onChange={e => updateLinea(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded border border-gray-200 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={l.precio_unitario}
                          onChange={e => updateLinea(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded border border-gray-200 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={l.descuento_porcentaje}
                          onChange={e => updateLinea(idx, 'descuento_porcentaje', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded border border-gray-200 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <select
                          value={l.impuesto_id}
                          onChange={e => updateLinea(idx, 'impuesto_id', e.target.value)}
                          className="w-full h-8 rounded border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Sin IVA</option>
                          {impuestos.map(i => <option key={i.id} value={i.id}>{i.porcentaje}% {i.codigo}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-1 text-right font-mono font-medium text-gray-900">
                        {formatCOP(c.total)}
                      </td>
                      <td className="py-2 pl-2">
                        <button
                          type="button"
                          onClick={() => quitarLinea(idx)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totales */}
      {lineas.length > 0 && (
        <div className="flex justify-end">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono">{formatCOP(subtotal)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Descuento</span>
                <span className="font-mono">-{formatCOP(descuento)}</span>
              </div>
            )}
            {totalIva > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>IVA</span>
                <span className="font-mono">{formatCOP(totalIva)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
              <span>TOTAL</span>
              <span className="font-mono text-blue-700">{formatCOP(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/ventas/facturas')} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" variant="success" disabled={guardando || !lineas.length}>
          {guardando ? 'Creando factura...' : 'Crear factura'}
        </Button>
      </div>
    </form>
  )
}
