'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { formatCOP, cardCls } from '@/utils/cn'
import type { Bodega, Impuesto } from '@/types'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'

type Theme = 'orange'

interface ProveedorOption {
  id: string
  razon_social: string
  numero_documento?: string | null
}

interface ProductoOption {
  id: string
  codigo: string
  descripcion: string
  precio_compra: number
  impuesto_id?: string | null
}

interface Linea {
  producto_id: string
  producto_codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_id: string
  iva_pct: number
}

interface Props {
  endpoint: string
  successPath: (id: string) => string
  submitLabel: string
  mode: 'compra' | 'orden'
  bodegas: Bodega[]
  impuestos: Impuesto[]
}

const THEME_STYLES: Record<Theme, { ring: string; button: string; total: string }> = {
  orange: {
    ring: 'focus:ring-orange-500',
    button: 'bg-orange-600 hover:bg-orange-700 text-white',
    total: 'text-orange-700',
  },
}

function calcLinea(linea: Linea) {
  const subtotal = linea.cantidad * linea.precio_unitario
  const descuento = subtotal * (linea.descuento_porcentaje / 100)
  const base = subtotal - descuento
  const iva = base * (linea.iva_pct / 100)
  return { subtotal, descuento, iva, total: base + iva }
}

function formatProveedorLabel(proveedor: ProveedorOption) {
  if (!proveedor.numero_documento) return proveedor.razon_social
  return `${proveedor.razon_social} (${proveedor.numero_documento})`
}

function formatProductoLabel(producto: { codigo?: string; descripcion?: string }) {
  return [producto.codigo, producto.descripcion].filter(Boolean).join(' · ')
}

export function RemotePurchaseDocumentForm({
  endpoint,
  successPath,
  submitLabel,
  mode,
  bodegas,
  impuestos,
}: Props) {
  const router = useRouter()
  const themeStyles = THEME_STYLES.orange
  const hoy = new Date().toISOString().slice(0, 10)
  const en15 = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)

  const [proveedorId, setProveedorId] = useState('')
  const [proveedorLabel, setProveedorLabel] = useState('')
  const [bodegaId, setBodegaId] = useState(bodegas.find((bodega) => bodega.principal)?.id ?? bodegas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoy)
  const [vencimiento, setVencimiento] = useState(en15)
  const [numeroExterno, setNumeroExterno] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<Linea[]>(mode === 'compra' ? [{
    producto_id: '',
    producto_codigo: '',
    descripcion: '',
    cantidad: 1,
    precio_unitario: 0,
    descuento_porcentaje: 0,
    impuesto_id: impuestos[0]?.id ?? '',
    iva_pct: impuestos[0]?.porcentaje ?? 0,
  }] : [])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function agregarLinea() {
    const impuestoBase = impuestos[0]
    setLineas((prev) => [...prev, {
      producto_id: '',
      producto_codigo: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      descuento_porcentaje: 0,
      impuesto_id: impuestoBase?.id ?? '',
      iva_pct: impuestoBase?.porcentaje ?? 0,
    }])
  }

  function handleProductoSelect(idx: number, producto: ProductoOption) {
    const impuesto = impuestos.find((item) => item.id === producto.impuesto_id) ?? impuestos[0]
    setLineas((prev) => prev.map((linea, index) => index !== idx ? linea : {
      ...linea,
      producto_id: producto.id,
      producto_codigo: producto.codigo ?? '',
      descripcion: producto.descripcion ?? '',
      precio_unitario: Number(producto.precio_compra ?? 0),
      impuesto_id: impuesto?.id ?? '',
      iva_pct: impuesto?.porcentaje ?? 0,
    }))
  }

  function clearProducto(idx: number) {
    setLineas((prev) => prev.map((linea, index) => index !== idx ? linea : {
      ...linea,
      producto_id: '',
      producto_codigo: '',
      descripcion: '',
      precio_unitario: 0,
    }))
  }

  function updateLinea(idx: number, field: keyof Linea, value: string | number) {
    setLineas((prev) => prev.map((linea, index) => {
      if (index !== idx) return linea
      const updated = { ...linea, [field]: value }
      if (field === 'impuesto_id') {
        updated.iva_pct = impuestos.find((item) => item.id === value)?.porcentaje ?? 0
      }
      return updated
    }))
  }

  const calcs = lineas.map(calcLinea)
  const subtotal = calcs.reduce((sum, calc) => sum + calc.subtotal, 0)
  const descuento = calcs.reduce((sum, calc) => sum + calc.descuento, 0)
  const totalIva = calcs.reduce((sum, calc) => sum + calc.iva, 0)
  const total = calcs.reduce((sum, calc) => sum + calc.total, 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!proveedorId) { setError('Selecciona un proveedor'); return }
    if (mode === 'compra' && !numeroExterno.trim()) { setError('Ingresa el numero de factura del proveedor'); return }
    if (!lineas.length) { setError('Agrega al menos un producto'); return }
    if (lineas.some((linea) => !linea.producto_id)) { setError('Completa todos los productos'); return }

    setGuardando(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        proveedor_id: proveedorId,
        bodega_id: bodegaId,
        fecha,
        observaciones: observaciones || null,
        lineas: lineas.map((linea) => ({
          producto_id: linea.producto_id,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          precio_unitario: linea.precio_unitario,
          descuento_porcentaje: linea.descuento_porcentaje,
          impuesto_id: linea.impuesto_id || null,
        })),
      }

      if (mode === 'compra') {
        body.numero_externo = numeroExterno.trim()
      } else {
        body.vencimiento = vencimiento
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push(successPath(data.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error')
      setGuardando(false)
    }
  }

  const inputClass = `h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 ${themeStyles.ring}`

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className={`${cardCls} p-5`}>
        <h3 className="mb-4 text-sm font-semibold text-gray-700">{mode === 'compra' ? 'Datos de la compra' : 'Informacion general'}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Proveedor *</label>
            <RemoteLookup<ProveedorOption>
              endpoint="/api/compras/proveedores"
              responseKey="proveedores"
              value={proveedorId}
              initialLabel={proveedorLabel}
              placeholder="Buscar por razon social o documento"
              emptyMessage="Sin proveedores para mostrar"
              queryParams={{ activo: true }}
              minChars={1}
              onSelect={(proveedor) => {
                setProveedorId(proveedor.id)
                setProveedorLabel(formatProveedorLabel(proveedor))
              }}
              onClear={() => {
                setProveedorId('')
                setProveedorLabel('')
              }}
              getOptionLabel={(proveedor) => formatProveedorLabel(proveedor)}
            />
          </div>

          {mode === 'compra' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">N° Factura proveedor *</label>
              <input value={numeroExterno} onChange={(event) => setNumeroExterno(event.target.value)} className={inputClass} required />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha</label>
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className={inputClass} />
          </div>

          {mode === 'orden' && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Entrega estimada</label>
              <input type="date" value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} className={inputClass} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Bodega *</label>
            <select value={bodegaId} onChange={(event) => setBodegaId(event.target.value)} required className={inputClass}>
              {bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={2}
              className={`rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${themeStyles.ring}`}
            />
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{mode === 'compra' ? 'Articulos' : 'Productos a ordenar'}</h3>
          <Button type="button" size="sm" variant="outline" onClick={agregarLinea}>
            <Plus className="mr-1 h-4 w-4" /> Agregar linea
          </Button>
        </div>

        {lineas.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No hay productos. Haz clic en &quot;Agregar linea&quot;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-2 text-left font-medium text-gray-600">Producto</th>
                  <th className="w-20 pb-2 text-right font-medium text-gray-600">Cant.</th>
                  <th className="w-28 pb-2 text-right font-medium text-gray-600">P. Costo</th>
                  <th className="w-20 pb-2 text-right font-medium text-gray-600">Dcto %</th>
                  <th className="w-28 pb-2 text-left font-medium text-gray-600">IVA</th>
                  <th className="w-28 pb-2 text-right font-medium text-gray-600">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineas.map((linea, idx) => {
                  const calc = calcLinea(linea)
                  return (
                    <tr key={idx}>
                      <td className="py-2 pr-2 align-top">
                        <RemoteLookup<ProductoOption>
                          endpoint="/api/productos"
                          responseKey="productos"
                          value={linea.producto_id}
                          initialLabel={linea.producto_id ? formatProductoLabel({ codigo: linea.producto_codigo, descripcion: linea.descripcion }) : ''}
                          placeholder="Buscar por codigo o nombre"
                          emptyMessage="Sin productos para mostrar"
                          queryParams={{ activo: true }}
                          minChars={1}
                          onSelect={(producto) => handleProductoSelect(idx, producto)}
                          onClear={() => clearProducto(idx)}
                          getOptionLabel={(producto) => formatProductoLabel(producto)}
                          getOptionDescription={(producto) => formatCOP(Number(producto.precio_compra ?? 0))}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={linea.cantidad}
                          onChange={(event) => updateLinea(idx, 'cantidad', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={linea.precio_unitario}
                          onChange={(event) => updateLinea(idx, 'precio_unitario', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={linea.descuento_porcentaje}
                          onChange={(event) => updateLinea(idx, 'descuento_porcentaje', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <select
                          value={linea.impuesto_id}
                          onChange={(event) => updateLinea(idx, 'impuesto_id', event.target.value)}
                          className={`h-8 w-full rounded border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        >
                          <option value="">Sin IVA</option>
                          {impuestos.map((impuesto) => (
                            <option key={impuesto.id} value={impuesto.id}>
                              {impuesto.descripcion ?? impuesto.codigo ?? 'Impuesto'} {impuesto.porcentaje}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-right font-mono text-gray-900">{formatCOP(calc.total)}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => setLineas((prev) => prev.filter((_, index) => index !== idx))}
                          className="text-red-400 hover:text-red-600"
                        >
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

        <div className="mt-4 flex flex-col items-end gap-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex gap-8 text-gray-600"><span>Subtotal</span><span className="w-28 text-right font-mono">{formatCOP(subtotal)}</span></div>
          {descuento > 0 && <div className="flex gap-8 text-gray-500"><span>Descuento</span><span className="w-28 text-right font-mono">-{formatCOP(descuento)}</span></div>}
          <div className="flex gap-8 text-gray-600"><span>IVA</span><span className="w-28 text-right font-mono">{formatCOP(totalIva)}</span></div>
          <div className="flex gap-8 text-base font-bold text-gray-900"><span>TOTAL</span><span className={`w-28 text-right font-mono ${themeStyles.total}`}>{formatCOP(total)}</span></div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
          <span className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={guardando} className={themeStyles.button}>
          {guardando ? 'Guardando...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
