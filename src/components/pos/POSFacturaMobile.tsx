'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Calculator, CheckCircle, Plus, Receipt, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { ClienteLookupField } from '@/components/clientes/ClienteLookupField'
import { type ClienteLookupOption, formatClienteLookupLabel } from '@/components/clientes/ClienteQuickCreateButton'
import { calcularFechaVencimientoFormaPago, isSistecreditoFormaPago } from '@/lib/utils/formas-pago'
import { buildFacturaPrintHref, type FacturaPrintFormat } from '@/lib/print/factura'
import { cardCls, formatCOP, todayLocalISODate } from '@/utils/cn'
import type { Bodega, Impuesto } from '@/types'
import {
  applyProductoToLinea,
  calcLinea,
  createEmptyFacturaLinea,
  descuentoToPct,
  formatProductoLabel,
  getDefaultBodegaId,
  updateLineaTotal,
  type FacturaColaborador,
  type FacturaFormaPago,
  type FacturaLinea,
  type FacturaProductoOption,
} from '@/components/ventas/factura-helpers'

interface POSFacturaMobileProps {
  impuestos: Impuesto[]
  bodegas: Bodega[]
  formasPago: FacturaFormaPago[]
  colaboradores: FacturaColaborador[]
}

const CONSUMIDOR_FINAL_DOCUMENTO = '222222222222'

function isEfectivoFormaPago(formaPago?: FacturaFormaPago | null) {
  return (formaPago?.descripcion ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .includes('efectivo')
}

export function POSFacturaMobile({ impuestos, bodegas, formasPago, colaboradores }: POSFacturaMobileProps) {
  const router = useRouter()
  const [hoy] = useState(() => todayLocalISODate())
  const [clienteId, setClienteId] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')
  const [bodegaId, setBodegaId] = useState(getDefaultBodegaId(bodegas))
  const [formaPagoId, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [colaboradorId, setColaboradorId] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [fechaVencimiento, setFechaVencimiento] = useState(() => calcularFechaVencimientoFormaPago(formasPago[0], hoy))
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<FacturaLinea[]>([])
  const [consumidorFinal, setConsumidorFinal] = useState<ClienteLookupOption | null>(null)
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [productoLookupKey, setProductoLookupKey] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null)

  const formaPagoSeleccionada = formasPago.find((formaPago) => formaPago.id === formaPagoId)
  const mostrarEfectivo = isEfectivoFormaPago(formaPagoSeleccionada)

  useEffect(() => {
    let cancelled = false

    async function cargarConsumidorFinal() {
      try {
        const params = new URLSearchParams({
          q: CONSUMIDOR_FINAL_DOCUMENTO,
          limit: '1',
          activo: 'true',
          select_mode: 'selector',
          include_total: 'false',
        })
        const res = await fetch(`/api/clientes?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        const found = Array.isArray(data?.clientes) ? data.clientes[0] as ClienteLookupOption | undefined : undefined
        if (!cancelled && found?.id) {
          setConsumidorFinal(found)
          setClienteId(found.id)
          setClienteLabel(formatClienteLookupLabel(found))
        }
      } catch {
        // Consumidor Final es un default conveniente; si falla, el usuario selecciona cliente manualmente.
      }
    }

    void cargarConsumidorFinal()
    return () => {
      cancelled = true
    }
  }, [])

  function actualizarVencimiento(nextFormaPagoId: string, fechaBase: string) {
    setFormaPagoId(nextFormaPagoId)
    const fp = formasPago.find((formaPago) => formaPago.id === nextFormaPagoId)
    setFechaVencimiento(calcularFechaVencimientoFormaPago(fp, fechaBase))
    if (!isEfectivoFormaPago(fp)) {
      setEfectivoRecibido('')
    }
  }

  function agregarProducto(producto: FacturaProductoOption) {
    setLineas((prev) => {
      const idx = prev.findIndex((linea) => linea.producto_id === producto.id)
      if (idx >= 0) {
        return prev.map((linea, index) =>
          index === idx ? { ...linea, cantidad: linea.cantidad + 1 } : linea
        )
      }

      return [
        ...prev,
        applyProductoToLinea(createEmptyFacturaLinea(impuestos), producto, impuestos),
      ]
    })
    setProductoLookupKey((prev) => prev + 1)
  }

  function updateLinea(idx: number, field: keyof FacturaLinea, value: string | number) {
    setLineas((prev) => prev.map((linea, index) => {
      if (index !== idx) return linea
      const updated = { ...linea, [field]: value }
      if (field === 'impuesto_id') {
        const impuesto = impuestos.find((item) => item.id === value)
        updated.iva_pct = impuesto?.porcentaje ?? 0
      }
      return updated
    }))
  }

  function updateTotal(idx: number, nuevoTotal: number) {
    setLineas((prev) => prev.map((linea, index) =>
      index !== idx ? linea : updateLineaTotal(linea, nuevoTotal)
    ))
  }

  function quitarLinea(idx: number) {
    setLineas((prev) => prev.filter((_, index) => index !== idx))
  }

  function resetVenta() {
    setLineas([])
    setEfectivoRecibido('')
    setObservaciones('')
    setError('')
    setResultado(null)
    if (consumidorFinal) {
      setClienteId(consumidorFinal.id)
      setClienteLabel(formatClienteLookupLabel(consumidorFinal))
    }
    setProductoLookupKey((prev) => prev + 1)
  }

  const calcs = lineas.map(calcLinea)
  const subtotal = calcs.reduce((sum, calc) => sum + calc.subtotal, 0)
  const descuento = calcs.reduce((sum, calc) => sum + calc.descuento, 0)
  const totalIva = calcs.reduce((sum, calc) => sum + calc.iva, 0)
  const total = calcs.reduce((sum, calc) => sum + calc.total, 0)
  const cambio = efectivoRecibido ? Math.max(0, Number(efectivoRecibido) - total) : 0

  function abrirTicket(formato: FacturaPrintFormat) {
    if (!resultado) return
    const href = buildFacturaPrintHref(resultado.id, formato)
    const popup = window.open(href, '_blank', 'noopener,noreferrer')
    if (!popup) {
      router.push(href)
    }
  }

  async function crearFactura() {
    if (!clienteId) {
      setError('Selecciona un cliente o crea Consumidor Final.')
      return
    }
    if (!bodegaId || !formaPagoId) {
      setError('Selecciona bodega y forma de pago.')
      return
    }
    if (!lineas.length) {
      setError('Agrega al menos un producto.')
      return
    }

    for (const linea of lineas) {
      if (!linea.producto_id) {
        setError('Selecciona un producto en todas las líneas.')
        return
      }
      if (linea.cantidad <= 0) {
        setError('La cantidad debe ser mayor a 0.')
        return
      }
    }

    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/ventas/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          bodega_id: bodegaId,
          forma_pago_id: formaPagoId,
          colaborador_id: colaboradorId || null,
          fecha,
          fecha_vencimiento: fechaVencimiento || null,
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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear la factura')

      setResultado({ id: data.id, numero: data.numero ?? data.id.slice(0, 8) })
      setLineas([])
      setEfectivoRecibido('')
      setObservaciones('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = 'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-600 dark:bg-gray-900/90 dark:text-gray-50 dark:placeholder:text-gray-500'
  const noSpinnerCls = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  if (resultado) {
    return (
      <div className="mobile-pos-flow mx-auto flex max-w-md flex-col gap-5 pt-5">
        <div className={`${cardCls} flex flex-col items-center gap-4 p-6 text-center shadow-sm`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Factura creada</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Venta móvil registrada correctamente.</p>
            <p className="mt-2 font-mono text-xs text-gray-400 dark:text-gray-500">{resultado.numero}</p>
          </div>
          <div className="grid w-full gap-2">
            <Button type="button" onClick={() => abrirTicket('termica-80')} className="w-full">
              Ticket 80 mm
            </Button>
            <Button type="button" variant="outline" onClick={() => abrirTicket('termica-58')} className="w-full">
              Ticket 58 mm
            </Button>
            <Button type="button" variant="secondary" onClick={resetVenta} className="w-full">
              Nueva venta
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-pos-flow mx-auto flex max-w-md flex-col gap-4">
      <section className={`${cardCls} p-4 shadow-sm`}>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">POS móvil</h1>
          </div>
        </div>

        <div className="grid gap-3">
          <ClienteLookupField
            value={clienteId}
            initialLabel={clienteLabel}
            lookupClassName="z-20"
            onChange={(cliente: ClienteLookupOption | null) => {
              setClienteId(cliente?.id ?? '')
              setClienteLabel(cliente ? formatClienteLookupLabel(cliente) : '')
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Forma de pago</label>
              <select value={formaPagoId} onChange={(event) => actualizarVencimiento(event.target.value, fecha)} className={inputCls}>
                {formasPago.map((formaPago) => (
                  <option key={formaPago.id} value={formaPago.id}>{formaPago.descripcion}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Bodega</label>
              <select value={bodegaId} onChange={(event) => setBodegaId(event.target.value)} className={inputCls}>
                {bodegas.map((bodega) => (
                  <option key={bodega.id} value={bodega.id}>{bodega.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(event) => {
                  const nextFecha = event.target.value
                  setFecha(nextFecha)
                  if (formaPagoId) actualizarVencimiento(formaPagoId, nextFecha)
                }}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Vence</label>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(event) => setFechaVencimiento(event.target.value)}
                disabled={isSistecreditoFormaPago(formaPagoSeleccionada)}
                className={inputCls}
              />
            </div>
          </div>

          {colaboradores.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Vendedor</label>
              <select value={colaboradorId} onChange={(event) => setColaboradorId(event.target.value)} className={inputCls}>
                <option value="">Sin vendedor</option>
                {colaboradores.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>{colaborador.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Observaciones</label>
            <input
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              placeholder="Nota para esta venta..."
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className={`${cardCls} p-4 shadow-sm`}>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">Agregar producto</label>
          <RemoteLookup<FacturaProductoOption>
            key={productoLookupKey}
            endpoint="/api/ventas/productos-selector"
            responseKey="productos"
            value=""
            placeholder="Buscar por código o nombre..."
            emptyMessage="Sin productos para mostrar"
            queryParams={{ activo: true }}
            minChars={1}
            panelClassName="max-w-[92vw]"
            resultsClassName="max-h-72"
            optionClassName="py-3"
            onSelect={agregarProducto}
            getOptionLabel={(producto) => formatProductoLabel(producto)}
            getOptionDescription={(producto) => formatCOP(Number(producto.precio_venta ?? 0))}
          />
        </div>

        {lineas.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 px-4 py-8 text-center dark:border-gray-700">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sin productos agregados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lineas.map((linea, idx) => {
              const calc = calcLinea(linea)
              return (
                <article key={`${linea.producto_id}-${idx}`} className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-700 dark:bg-gray-900/70">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{linea.descripcion}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-400 dark:text-gray-500">{linea.producto_codigo}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => quitarLinea(idx)}
                      aria-label={`Eliminar producto ${idx + 1}`}
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Cant.</label>
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
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Precio unit.</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={linea.precio_unitario}
                        onChange={(event) => updateLinea(idx, 'precio_unitario', parseFloat(event.target.value) || 0)}
                        className={`${inputCls} ${noSpinnerCls} text-right`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Descuento $</label>
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
                      <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">IVA</label>
                      <select
                        value={linea.impuesto_id}
                        onChange={(event) => updateLinea(idx, 'impuesto_id', event.target.value)}
                        className={inputCls}
                      >
                        <option value="">Sin IVA</option>
                        {impuestos.map((impuesto) => (
                          <option key={impuesto.id} value={impuesto.id}>{impuesto.porcentaje}%</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Total línea</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={Math.round(calc.total)}
                      onChange={(event) => updateTotal(idx, parseFloat(event.target.value) || 0)}
                      className={`${inputCls} ${noSpinnerCls} text-right font-mono font-semibold`}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className={`${cardCls} mobile-pos-action-bar sticky z-30 space-y-3 p-4 shadow-xl shadow-slate-950/10`}>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
            <span>Subtotal</span>
            <span className="font-mono">{formatCOP(subtotal)}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
              <span>Descuento</span>
              <span className="font-mono">-{formatCOP(descuento)}</span>
            </div>
          )}
          {totalIva > 0 && (
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>IVA</span>
              <span className="font-mono">{formatCOP(totalIva)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900 dark:border-gray-800 dark:text-gray-100">
            <span>Total</span>
            <span className="font-mono text-teal-700 dark:text-teal-300">{formatCOP(total)}</span>
          </div>
        </div>

        {mostrarEfectivo && (
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Calculator className="h-3.5 w-3.5" /> Efectivo recibido
              </span>
              <input
                type="number"
                value={efectivoRecibido}
                onChange={(event) => setEfectivoRecibido(event.target.value)}
                placeholder="0"
                className={`${inputCls} ${noSpinnerCls} text-right`}
              />
            </label>
            <div className="pb-1 text-right">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Cambio</p>
              <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCOP(cambio)}</p>
            </div>
          </div>
        )}

        <Button type="button" onClick={crearFactura} disabled={guardando || lineas.length === 0} className="h-11 w-full">
          <Plus className="h-4 w-4" />
          {guardando ? 'Facturando...' : 'Facturar'}
        </Button>
      </section>
    </div>
  )
}
