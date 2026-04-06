'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { calcularFechaVencimientoFormaPago, isSistecreditoFormaPago } from '@/lib/utils/formas-pago'

import type { Impuesto, Bodega } from '@/types'
import { formatCOP, cardCls } from '@/utils/cn'
import { Plus, Trash2, AlertCircle } from 'lucide-react'

interface FormaPago { id: string; descripcion: string; tipo: string; dias_vencimiento: number }
interface Colaborador { id: string; nombre: string }

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
  descuento_valor: number
  impuesto_id: string
  iva_pct: number
}

function calcLinea(l: Linea) {
  const subtotal = l.cantidad * l.precio_unitario
  const descuento = Math.min(l.descuento_valor, subtotal)
  const base = subtotal - descuento
  const iva = base * (l.iva_pct / 100)
  return { subtotal, descuento, iva, total: base + iva }
}

/** Convert absolute discount to percentage for backend */
function descuentoToPct(linea: Linea): number {
  const subtotal = linea.cantidad * linea.precio_unitario
  if (subtotal <= 0 || linea.descuento_valor <= 0) return 0
  return Math.round(((linea.descuento_valor / subtotal) * 100) * 10000) / 10000
}

interface Props {
  impuestos: Impuesto[]
  bodegas: Bodega[]
  formasPago: FormaPago[]
  colaboradores: Colaborador[]
}

const hoy = new Date().toISOString().slice(0, 10)

function formatClienteLabel(cliente: ClienteOption) {
  if (!cliente.numero_documento) return cliente.razon_social
  return `${cliente.razon_social} (${cliente.numero_documento})`
}

function formatProductoLabel(producto: { codigo?: string; descripcion?: string }) {
  return [producto.codigo, producto.descripcion].filter(Boolean).join(' · ')
}

export function FormFactura({ impuestos, bodegas, formasPago, colaboradores }: Props) {
  const router = useRouter()

  const [cliente_id, setClienteId] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')
  const [bodega_id, setBodegaId] = useState(bodegas.find((b) => b.principal)?.id ?? bodegas[0]?.id ?? '')
  const [forma_pago_id, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [colaborador_id, setColaboradorId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [fecha_vencimiento, setVencimiento] = useState(() => calcularFechaVencimientoFormaPago(formasPago[0], hoy))
  const [observaciones, setObs] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function actualizarVencimiento(id: string, fechaBase: string) {
    setFormaPagoId(id)
    const fp = formasPago.find((f) => f.id === id)
    setVencimiento(calcularFechaVencimientoFormaPago(fp, fechaBase))
  }

  function handleFormaPago(id: string) {
    actualizarVencimiento(id, fecha)
  }

  function agregarLinea() {
    const impuestoBase = impuestos[0]
    setLineas((prev) => [...prev, {
      producto_id: '',
      producto_codigo: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      descuento_valor: 0,
      impuesto_id: impuestoBase?.id ?? '',
      iva_pct: impuestoBase?.porcentaje ?? 0,
    }])
  }

  function handleProductoSelect(idx: number, producto: ProductoOption) {
    const imp = impuestos.find((item) => item.id === producto.impuesto_id) ?? impuestos[0]
    setLineas((prev) => prev.map((linea, index) => index !== idx ? linea : {
      ...linea,
      producto_id: producto.id,
      producto_codigo: producto.codigo ?? '',
      descripcion: producto.descripcion ?? '',
      precio_unitario: Number(producto.precio_venta ?? 0),
      impuesto_id: imp?.id ?? '',
      iva_pct: imp?.porcentaje ?? 0,
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
        const imp = impuestos.find((item) => item.id === value)
        updated.iva_pct = imp?.porcentaje ?? 0
      }
      return updated
    }))
  }

  function updateTotal(idx: number, nuevoTotal: number) {
    setLineas((prev) => prev.map((linea, index) => {
      if (index !== idx) return linea
      const qty = linea.cantidad || 1
      const ivaMult = 1 + (linea.iva_pct / 100)
      const base = nuevoTotal / ivaMult
      const precioUnitario = (base + linea.descuento_valor) / qty
      return { ...linea, precio_unitario: Math.round(precioUnitario * 100) / 100 }
    }))
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, index) => index !== idx))
  }

  const calcs = lineas.map(calcLinea)
  const subtotal = calcs.reduce((sum, calc) => sum + calc.subtotal, 0)
  const descuento = calcs.reduce((sum, calc) => sum + calc.descuento, 0)
  const totalIva = calcs.reduce((sum, calc) => sum + calc.iva, 0)
  const total = calcs.reduce((sum, calc) => sum + calc.total, 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!cliente_id) { setError('Selecciona un cliente'); return }
    if (!lineas.length) { setError('Agrega al menos un producto'); return }

    for (const linea of lineas) {
      if (!linea.producto_id) { setError('Selecciona un producto en todas las líneas'); return }
      if (linea.cantidad <= 0) { setError('La cantidad debe ser mayor a 0'); return }
    }

    setGuardando(true)
    setError('')

    try {
      const payload = {
        cliente_id,
        bodega_id,
        forma_pago_id,
        colaborador_id: colaborador_id || null,
        fecha,
        fecha_vencimiento: fecha_vencimiento || null,
        observaciones: observaciones || null,
        lineas: lineas.map((linea) => ({
          producto_id: linea.producto_id,
          variante_id: null,
          descripcion: linea.descripcion,
          cantidad: linea.cantidad,
          precio_unitario: linea.precio_unitario,
          descuento_porcentaje: descuentoToPct(linea),
          impuesto_id: linea.impuesto_id || null,
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error')
      setGuardando(false)
    }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const noSpinnerCls = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className={`${cardCls} p-5`}>
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Informacion general</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label className="text-sm font-medium text-gray-700">Cliente *</label>
            <RemoteLookup<ClienteOption>
              endpoint="/api/clientes"
              responseKey="clientes"
              value={cliente_id}
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
            <label className="text-sm font-medium text-gray-700">Forma de pago *</label>
            <select
              value={forma_pago_id}
              onChange={(event) => handleFormaPago(event.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {formasPago.map((formaPago) => (
                <option key={formaPago.id} value={formaPago.id}>
                  {formaPago.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Bodega *</label>
            <select
              value={bodega_id}
              onChange={(event) => setBodegaId(event.target.value)}
              required
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={(event) => {
                const nuevaFecha = event.target.value
                setFecha(nuevaFecha)
                if (forma_pago_id) actualizarVencimiento(forma_pago_id, nuevaFecha)
              }}
              required
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha vencimiento</label>
            <input
              type="date"
              value={fecha_vencimiento}
              onChange={(event) => setVencimiento(event.target.value)}
              disabled={isSistecreditoFormaPago(formasPago.find((formaPago) => formaPago.id === forma_pago_id))}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isSistecreditoFormaPago(formasPago.find((formaPago) => formaPago.id === forma_pago_id)) && (
              <p className="text-xs text-blue-600">Sistecredito proyecta cobro el dia 15 del cuarto mes.</p>
            )}
          </div>

          {colaboradores.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Vendedor</label>
              <select
                value={colaborador_id}
                onChange={(event) => setColaboradorId(event.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sin vendedor</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={(event) => setObs(event.target.value)}
              placeholder="Nota interna o para el cliente..."
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Articulos</h3>
          <Button type="button" size="sm" onClick={agregarLinea}>
            <Plus className="mr-1 h-4 w-4" /> Agregar linea
          </Button>
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
            <p className="text-sm text-gray-400">Agrega productos a la factura</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={agregarLinea}>
              <Plus className="mr-1 h-4 w-4" /> Agregar primer articulo
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="pb-2 pl-1 pr-2">Producto</th>
                    <th className="w-24 pb-2 px-2 text-right">Cant.</th>
                    <th className="w-32 pb-2 px-2 text-right">Precio unit.</th>
                    <th className="w-32 pb-2 px-2 text-right">Descuento $</th>
                    <th className="w-32 pb-2 px-2">IVA</th>
                    <th className="w-32 pb-2 px-2 text-right">Total</th>
                    <th className="w-10 pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineas.map((linea, idx) => {
                    const calc = calcLinea(linea)
                    return (
                      <tr key={idx} className="group">
                        <td className="py-2 pl-1 pr-2">
                          <RemoteLookup<ProductoOption>
                            endpoint="/api/productos"
                            responseKey="productos"
                            value={linea.producto_id}
                            initialLabel={linea.producto_id ? formatProductoLabel({
                              codigo: linea.producto_codigo,
                              descripcion: linea.descripcion,
                            }) : ''}
                            placeholder="Buscar producto..."
                            emptyMessage="Sin productos para mostrar"
                            queryParams={{ activo: true }}
                            minChars={1}
                            panelClassName="min-w-[28rem]"
                            resultsClassName="max-h-72"
                            optionClassName="py-2.5"
                            onSelect={(producto) => handleProductoSelect(idx, producto)}
                            onClear={() => clearProducto(idx)}
                            getOptionLabel={(producto) => formatProductoLabel(producto)}
                            getOptionDescription={(producto) => formatCOP(Number(producto.precio_venta ?? 0))}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={linea.cantidad}
                            onChange={(event) => updateLinea(idx, 'cantidad', parseFloat(event.target.value) || 0)}
                            className={`${inputCls} ${noSpinnerCls} text-right`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={linea.precio_unitario}
                            onChange={(event) => updateLinea(idx, 'precio_unitario', parseFloat(event.target.value) || 0)}
                            className={`${inputCls} ${noSpinnerCls} text-right`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={linea.descuento_valor}
                            onChange={(event) => updateLinea(idx, 'descuento_valor', parseFloat(event.target.value) || 0)}
                            className={`${inputCls} ${noSpinnerCls} text-right`}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={linea.impuesto_id}
                            onChange={(event) => updateLinea(idx, 'impuesto_id', event.target.value)}
                            className={inputCls}
                          >
                            <option value="">Sin IVA</option>
                            {impuestos.map((impuesto) => (
                              <option key={impuesto.id} value={impuesto.id}>
                                {impuesto.porcentaje}% {impuesto.codigo}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={Math.round(calc.total)}
                            onChange={(event) => updateTotal(idx, parseFloat(event.target.value) || 0)}
                            className={`${inputCls} ${noSpinnerCls} text-right font-mono font-medium`}
                          />
                        </td>
                        <td className="py-2 pl-1">
                          <button
                            type="button"
                            onClick={() => quitarLinea(idx)}
                            className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:text-gray-400"
                            aria-label={`Eliminar articulo ${idx + 1}`}
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

            {/* Mobile cards */}
            <div className="space-y-3 lg:hidden">
              {lineas.map((linea, idx) => {
                const calc = calcLinea(linea)
                return (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => quitarLinea(idx)}
                        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Eliminar articulo ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <RemoteLookup<ProductoOption>
                        endpoint="/api/productos"
                        responseKey="productos"
                        value={linea.producto_id}
                        initialLabel={linea.producto_id ? formatProductoLabel({
                          codigo: linea.producto_codigo,
                          descripcion: linea.descripcion,
                        }) : ''}
                        placeholder="Buscar producto..."
                        emptyMessage="Sin productos para mostrar"
                        queryParams={{ activo: true }}
                        minChars={1}
                        panelClassName="max-w-[92vw]"
                        resultsClassName="max-h-72"
                        optionClassName="py-2.5"
                        onSelect={(producto) => handleProductoSelect(idx, producto)}
                        onClear={() => clearProducto(idx)}
                        getOptionLabel={(producto) => formatProductoLabel(producto)}
                        getOptionDescription={(producto) => formatCOP(Number(producto.precio_venta ?? 0))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Cant.</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={linea.cantidad}
                          onChange={(event) => updateLinea(idx, 'cantidad', parseFloat(event.target.value) || 0)}
                          className={`${inputCls} ${noSpinnerCls} text-right`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Precio unit.</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={linea.precio_unitario}
                          onChange={(event) => updateLinea(idx, 'precio_unitario', parseFloat(event.target.value) || 0)}
                          className={`${inputCls} ${noSpinnerCls} text-right`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">Descuento $</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={linea.descuento_valor}
                          onChange={(event) => updateLinea(idx, 'descuento_valor', parseFloat(event.target.value) || 0)}
                          className={`${inputCls} ${noSpinnerCls} text-right`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-500">IVA</label>
                        <select
                          value={linea.impuesto_id}
                          onChange={(event) => updateLinea(idx, 'impuesto_id', event.target.value)}
                          className={inputCls}
                        >
                          <option value="">Sin IVA</option>
                          {impuestos.map((impuesto) => (
                            <option key={impuesto.id} value={impuesto.id}>
                              {impuesto.porcentaje}%
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="mb-1 block text-xs text-gray-500">Total</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={Math.round(calc.total)}
                        onChange={(event) => updateTotal(idx, parseFloat(event.target.value) || 0)}
                        className={`${inputCls} ${noSpinnerCls} text-right font-mono font-semibold`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex justify-start">
              <Button type="button" variant="outline" onClick={agregarLinea}>
                <Plus className="mr-1 h-4 w-4" /> Agregar otro articulo
              </Button>
            </div>
          </>
        )}
      </div>

      {lineas.length > 0 && (
        <div className="flex justify-end">
          <div className={`flex w-full max-w-sm flex-col gap-2 ${cardCls} p-4`}>
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

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

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
