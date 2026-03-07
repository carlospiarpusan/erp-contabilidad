'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface Proveedor { id: string; razon_social: string }
interface Producto  { id: string; codigo: string; descripcion: string; precio_compra: number; impuesto_id?: string | null }
interface Impuesto  { id: string; nombre?: string; descripcion?: string; codigo?: string; porcentaje: number }
interface Bodega    { id: string; nombre: string }

interface Linea {
  producto_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_id: string
  iva_pct: number
}

interface Props {
  proveedores: Proveedor[]
  productos:   Producto[]
  impuestos:   Impuesto[]
  bodegas:     Bodega[]
}

const lineaVacia = (): Linea => ({
  producto_id: '', descripcion: '', cantidad: 1,
  precio_unitario: 0, descuento_porcentaje: 0,
  impuesto_id: '', iva_pct: 0,
})

function calcLinea(l: Linea) {
  const sub    = l.cantidad * l.precio_unitario
  const dcto   = sub * l.descuento_porcentaje / 100
  const base   = sub - dcto
  const iva    = base * l.iva_pct / 100
  return { sub, dcto, iva, total: base + iva }
}

export function FormCompra({ proveedores, productos, impuestos, bodegas }: Props) {
  const router = useRouter()

  const [proveedor_id,  setProveedorId]  = useState('')
  const [bodega_id,     setBodegaId]     = useState(bodegas[0]?.id ?? '')
  const [fecha,         setFecha]        = useState(new Date().toISOString().split('T')[0])
  const [numero_externo, setNumeroExterno] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas,        setLineas]        = useState<Linea[]>([lineaVacia()])
  const [enviando,      setEnviando]      = useState(false)
  const [error,         setError]         = useState('')

  const totales = useMemo(() => {
    return lineas.reduce((acc, l) => {
      const c = calcLinea(l)
      return { sub: acc.sub + c.sub, dcto: acc.dcto + c.dcto, iva: acc.iva + c.iva, total: acc.total + c.total }
    }, { sub: 0, dcto: 0, iva: 0, total: 0 })
  }, [lineas])

  function setLinea(i: number, patch: Partial<Linea>) {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }

  function handleProducto(i: number, producto_id: string) {
    const p = productos.find(x => x.id === producto_id)
    if (!p) return
    const imp = impuestos.find(x => x.id === p.impuesto_id)
    setLinea(i, {
      producto_id,
      descripcion:    p.descripcion,
      precio_unitario: p.precio_compra ?? 0,
      impuesto_id:    imp?.id ?? '',
      iva_pct:        imp?.porcentaje ?? 0,
    })
  }

  function handleImpuesto(i: number, impuesto_id: string) {
    const imp = impuestos.find(x => x.id === impuesto_id)
    setLinea(i, { impuesto_id, iva_pct: imp?.porcentaje ?? 0 })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!proveedor_id)     return setError('Selecciona un proveedor')
    if (!numero_externo)   return setError('Ingresa el número de factura del proveedor')
    if (lineas.some(l => !l.producto_id)) return setError('Completa todos los productos')
    setEnviando(true)
    try {
      const res = await fetch('/api/compras/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id, bodega_id, fecha, numero_externo, observaciones,
          lineas: lineas.map(l => ({
            producto_id:         l.producto_id,
            descripcion:         l.descripcion,
            cantidad:            l.cantidad,
            precio_unitario:     l.precio_unitario,
            descuento_porcentaje: l.descuento_porcentaje,
            impuesto_id:         l.impuesto_id || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Error al crear la factura')
      router.push(`/compras/facturas/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setEnviando(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Datos del pedido</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelCls}>Proveedor *</label>
            <select value={proveedor_id} onChange={e => setProveedorId(e.target.value)} className={inputCls} required>
              <option value="">— Seleccionar —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>N° Factura proveedor *</label>
            <input value={numero_externo} onChange={e => setNumeroExterno(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Bodega *</label>
            <select value={bodega_id} onChange={e => setBodegaId(e.target.value)} className={inputCls}>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Observaciones</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Artículos</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => setLineas(prev => [...prev, lineaVacia()])}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-500 min-w-48">Producto</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 w-20">Cant.</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 w-28">P. Costo</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 w-20">Dcto %</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-500 w-28">IVA</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-500 w-28">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineas.map((l, i) => {
                const c = calcLinea(l)
                return (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <select
                        value={l.producto_id}
                        onChange={e => handleProducto(i, e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="">— Producto —</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min="0.001" step="0.001"
                        value={l.cantidad}
                        onChange={e => setLinea(i, { cantidad: Number(e.target.value) })}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={l.precio_unitario}
                        onChange={e => setLinea(i, { precio_unitario: Number(e.target.value) })}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={l.descuento_porcentaje}
                        onChange={e => setLinea(i, { descuento_porcentaje: Number(e.target.value) })}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={l.impuesto_id}
                        onChange={e => handleImpuesto(i, e.target.value)}
                        className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                      >
                        <option value="">Sin IVA</option>
                        {impuestos.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.descripcion ?? t.nombre ?? t.codigo ?? 'Impuesto'} {t.porcentaje}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-gray-900">{formatCOP(c.total)}</td>
                    <td className="py-2">
                      {lineas.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLineas(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="mt-4 flex flex-col items-end gap-1 text-sm border-t border-gray-100 pt-3">
          <div className="flex gap-8 text-gray-600">
            <span>Subtotal</span>
            <span className="font-mono w-28 text-right">{formatCOP(totales.sub)}</span>
          </div>
          {totales.dcto > 0 && (
            <div className="flex gap-8 text-gray-500">
              <span>Descuento</span>
              <span className="font-mono w-28 text-right">-{formatCOP(totales.dcto)}</span>
            </div>
          )}
          <div className="flex gap-8 text-gray-600">
            <span>IVA</span>
            <span className="font-mono w-28 text-right">{formatCOP(totales.iva)}</span>
          </div>
          <div className="flex gap-8 text-gray-900 font-bold text-base">
            <span>TOTAL</span>
            <span className="font-mono w-28 text-right text-orange-700">{formatCOP(totales.total)}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar factura de compra'}
        </Button>
      </div>
    </form>
  )
}
