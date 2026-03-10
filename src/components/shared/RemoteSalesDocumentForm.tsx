'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { formatCOP } from '@/utils/cn'
import type { Bodega, Impuesto } from '@/types'
import { AlertCircle, Plus, Trash2 } from 'lucide-react'

type Theme = 'green' | 'purple' | 'cyan'

interface ClienteOption {
  id: string
  razon_social: string
  numero_documento?: string | null
  email?: string | null
}

interface ProductoOption {
  id: string
  codigo: string
  descripcion: string
  precio_venta: number
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
  theme: Theme
  dateLabel?: string
  dueDateLabel?: string
  dueDateDefault: string
  observationsPlaceholder?: string
  bodegas: Bodega[]
  impuestos: Impuesto[]
}

const THEME_STYLES: Record<Theme, { ring: string; button: string; total: string }> = {
  green: {
    ring: 'focus:ring-green-500',
    button: 'bg-green-600 hover:bg-green-700 text-white',
    total: 'text-green-700',
  },
  purple: {
    ring: 'focus:ring-purple-500',
    button: 'bg-purple-600 hover:bg-purple-700 text-white',
    total: 'text-purple-700',
  },
  cyan: {
    ring: 'focus:ring-cyan-500',
    button: 'bg-cyan-600 hover:bg-cyan-700 text-white',
    total: 'text-cyan-700',
  },
}

function calcLinea(linea: Linea) {
  const subtotal = linea.cantidad * linea.precio_unitario
  const descuento = subtotal * (linea.descuento_porcentaje / 100)
  const base = subtotal - descuento
  const iva = base * (linea.iva_pct / 100)
  return { subtotal, descuento, iva, total: base + iva }
}

function formatClienteLabel(cliente: ClienteOption) {
  if (!cliente.numero_documento) return cliente.razon_social
  return `${cliente.razon_social} (${cliente.numero_documento})`
}

function formatProductoLabel(producto: { codigo?: string; descripcion?: string }) {
  return [producto.codigo, producto.descripcion].filter(Boolean).join(' · ')
}

export function RemoteSalesDocumentForm({
  endpoint,
  successPath,
  submitLabel,
  theme,
  dateLabel = 'Fecha',
  dueDateLabel = 'Válida hasta',
  dueDateDefault,
  observationsPlaceholder = 'Observaciones...',
  bodegas,
  impuestos,
}: Props) {
  const router = useRouter()
  const themeStyles = THEME_STYLES[theme]
  const hoy = new Date().toISOString().slice(0, 10)

  const [clienteId, setClienteId] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')
  const [bodegaId, setBodegaId] = useState(bodegas.find((bodega) => bodega.principal)?.id ?? bodegas[0]?.id ?? '')
  const [fecha, setFecha] = useState(hoy)
  const [vencimiento, setVencimiento] = useState(dueDateDefault)
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
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
      precio_unitario: Number(producto.precio_venta ?? 0),
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
    if (!clienteId) { setError('Selecciona un cliente'); return }
    if (!lineas.length) { setError('Agrega al menos un producto'); return }
    if (lineas.some((linea) => !linea.producto_id)) { setError('Completa todos los productos'); return }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          bodega_id: bodegaId,
          fecha,
          vencimiento,
          observaciones: observaciones || null,
          lineas: lineas.map((linea) => ({
            producto_id: linea.producto_id,
            descripcion: linea.descripcion,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            descuento_porcentaje: linea.descuento_porcentaje,
            impuesto_id: linea.impuesto_id || null,
          })),
        }),
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Informacion general</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Cliente *</label>
            <RemoteLookup<ClienteOption>
              endpoint="/api/clientes"
              responseKey="clientes"
              value={clienteId}
              initialLabel={clienteLabel}
              placeholder="Buscar por nombre, NIT o correo"
              emptyMessage="Sin clientes para mostrar"
              queryParams={{ activo: true }}
              minChars={1}
              onSelect={(cliente) => {
                setClienteId(cliente.id)
                setClienteLabel(formatClienteLabel(cliente))
              }}
              onClear={() => {
                setClienteId('')
                setClienteLabel('')
              }}
              getOptionLabel={(cliente) => formatClienteLabel(cliente)}
              getOptionDescription={(cliente) => cliente.email ?? undefined}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Bodega *</label>
            <select value={bodegaId} onChange={(event) => setBodegaId(event.target.value)} required className={inputClass}>
              {bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{dateLabel}</label>
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{dueDateLabel}</label>
            <input type="date" value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={2}
              placeholder={observationsPlaceholder}
              className={`rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${themeStyles.ring}`}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Productos</h3>
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
                  <th className="w-28 pb-2 text-right font-medium text-gray-600">Precio</th>
                  <th className="w-20 pb-2 text-right font-medium text-gray-600">Dcto%</th>
                  <th className="w-24 pb-2 text-right font-medium text-gray-600">IVA</th>
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
                          getOptionDescription={(producto) => formatCOP(Number(producto.precio_venta ?? 0))}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={linea.cantidad}
                          onChange={(event) => updateLinea(idx, 'cantidad', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={linea.precio_unitario}
                          onChange={(event) => updateLinea(idx, 'precio_unitario', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={linea.descuento_porcentaje}
                          onChange={(event) => updateLinea(idx, 'descuento_porcentaje', parseFloat(event.target.value) || 0)}
                          className={`h-8 w-full rounded-lg border border-gray-300 px-2 text-right text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <select
                          value={linea.impuesto_id}
                          onChange={(event) => updateLinea(idx, 'impuesto_id', event.target.value)}
                          className={`h-8 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 ${themeStyles.ring}`}
                        >
                          <option value="">Sin IVA</option>
                          {impuestos.map((impuesto) => (
                            <option key={impuesto.id} value={impuesto.id}>{impuesto.porcentaje}%</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pl-2 text-right font-mono font-medium text-gray-900">{formatCOP(calc.total)}</td>
                      <td className="py-2 pl-1">
                        <button
                          type="button"
                          onClick={() => setLineas((prev) => prev.filter((_, index) => index !== idx))}
                          className="text-gray-400 transition-colors hover:text-red-500"
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
      </div>

      {lineas.length > 0 && (
        <div className="flex justify-end">
          <div className="flex w-64 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-mono">{formatCOP(subtotal)}</span></div>
            {descuento > 0 && <div className="flex justify-between text-red-600"><span>Descuento</span><span className="font-mono">-{formatCOP(descuento)}</span></div>}
            <div className="flex justify-between text-gray-600"><span>IVA</span><span className="font-mono">{formatCOP(totalIva)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
              <span>TOTAL</span><span className={`font-mono ${themeStyles.total}`}>{formatCOP(total)}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
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
