'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Cliente, Producto, Impuesto, Bodega } from '@/types'
import { formatCOP } from '@/utils/cn'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

interface Linea {
  producto_id: string; descripcion: string; cantidad: number
  precio_unitario: number; descuento_porcentaje: number
  impuesto_id: string; iva_pct: number
}

function calcLinea(l: Linea) {
  const sub = l.cantidad * l.precio_unitario
  const dct = sub * (l.descuento_porcentaje / 100)
  const base = sub - dct
  const iva = base * (l.iva_pct / 100)
  return { sub, dct, iva, total: base + iva }
}

interface Props {
  clientes: Cliente[]
  productos: Producto[]
  impuestos: Impuesto[]
  bodegas: Bodega[]
}

const hoy = new Date().toISOString().slice(0, 10)
const en30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

export function FormCotizacion({ clientes, productos, impuestos, bodegas }: Props) {
  const router = useRouter()
  const [cliente_id, setClienteId] = useState('')
  const [bodega_id, setBodegaId] = useState(bodegas.find(b => b.principal)?.id ?? bodegas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoy)
  const [vencimiento, setVenc] = useState(en30)
  const [observaciones, setObs] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function agregarLinea() {
    const p0 = productos[0]
    const imp0 = impuestos.find(i => i.id === p0?.impuesto_id) ?? impuestos[0]
    setLineas(prev => [...prev, {
      producto_id: p0?.id ?? '', descripcion: p0?.descripcion ?? '',
      cantidad: 1, precio_unitario: p0?.precio_venta ?? 0,
      descuento_porcentaje: 0, impuesto_id: imp0?.id ?? '', iva_pct: imp0?.porcentaje ?? 0,
    }])
  }

  const handleProducto = useCallback((idx: number, producto_id: string) => {
    const p = productos.find(x => x.id === producto_id)
    const imp = impuestos.find(i => i.id === p?.impuesto_id)
    setLineas(prev => prev.map((l, i) => i !== idx ? l : {
      ...l, producto_id, descripcion: p?.descripcion ?? '',
      precio_unitario: p?.precio_venta ?? 0,
      impuesto_id: imp?.id ?? '', iva_pct: imp?.porcentaje ?? 0,
    }))
  }, [productos, impuestos])

  function updateLinea(idx: number, field: keyof Linea, value: string | number) {
    setLineas(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const u = { ...l, [field]: value }
      if (field === 'impuesto_id') u.iva_pct = impuestos.find(x => x.id === value)?.porcentaje ?? 0
      return u
    }))
  }

  const calcs = lineas.map(calcLinea)
  const subtotal = calcs.reduce((s, c) => s + c.sub, 0)
  const descuento = calcs.reduce((s, c) => s + c.dct, 0)
  const totalIva = calcs.reduce((s, c) => s + c.iva, 0)
  const total = calcs.reduce((s, c) => s + c.total, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente_id) { setError('Selecciona un cliente'); return }
    if (!lineas.length) { setError('Agrega al menos un producto'); return }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/ventas/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id, bodega_id, fecha, vencimiento, observaciones: observaciones || null,
          lineas: lineas.map(l => ({
            producto_id: l.producto_id, descripcion: l.descripcion,
            cantidad: l.cantidad, precio_unitario: l.precio_unitario,
            descuento_porcentaje: l.descuento_porcentaje, impuesto_id: l.impuesto_id || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push(`/ventas/cotizaciones/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Información general</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Cliente *</label>
            <select value={cliente_id} onChange={e => setClienteId(e.target.value)} required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Bodega *</label>
            <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Válida hasta</label>
            <input type="date" value={vencimiento} onChange={e => setVenc(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea value={observaciones} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Condiciones, notas para el cliente..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Productos</h3>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus className="h-4 w-4 mr-1" /> Agregar línea
          </Button>
        </div>

        {lineas.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No hay productos. Haz clic en &quot;Agregar línea&quot;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left font-medium text-gray-600">Producto</th>
                  <th className="pb-2 text-right font-medium text-gray-600 w-20">Cant.</th>
                  <th className="pb-2 text-right font-medium text-gray-600 w-28">Precio</th>
                  <th className="pb-2 text-right font-medium text-gray-600 w-20">Dcto%</th>
                  <th className="pb-2 text-right font-medium text-gray-600 w-24">IVA</th>
                  <th className="pb-2 text-right font-medium text-gray-600 w-28">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineas.map((l, idx) => {
                  const c = calcLinea(l)
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-2">
                        <select value={l.producto_id} onChange={e => handleProducto(idx, e.target.value)}
                          className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                          {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                        </select>
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="1" step="1" value={l.cantidad}
                          onChange={e => updateLinea(idx, 'cantidad', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="0" step="0.01" value={l.precio_unitario}
                          onChange={e => updateLinea(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                      <td className="py-2 px-1">
                        <input type="number" min="0" max="100" step="0.1" value={l.descuento_porcentaje}
                          onChange={e => updateLinea(idx, 'descuento_porcentaje', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </td>
                      <td className="py-2 px-1">
                        <select value={l.impuesto_id} onChange={e => updateLinea(idx, 'impuesto_id', e.target.value)}
                          className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500">
                          <option value="">Sin IVA</option>
                          {impuestos.map(i => <option key={i.id} value={i.id}>{i.porcentaje}%</option>)}
                        </select>
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-medium text-gray-900">{formatCOP(c.total)}</td>
                      <td className="py-2 pl-1">
                        <button type="button" onClick={() => setLineas(prev => prev.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
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
          <div className="w-64 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 flex flex-col gap-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-mono">{formatCOP(subtotal)}</span></div>
            {descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento</span><span className="font-mono">-{formatCOP(descuento)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>IVA</span><span className="font-mono">{formatCOP(totalIva)}</span></div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>TOTAL</span><span className="font-mono text-green-700">{formatCOP(total)}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" variant="success" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Crear cotización'}
        </Button>
      </div>
    </form>
  )
}
