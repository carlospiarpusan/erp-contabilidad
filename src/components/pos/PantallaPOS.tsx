'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Minus, Trash2, ShoppingCart, Calculator, User, X, CheckCircle } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface ProductoSimple {
  id: string
  codigo: string
  descripcion: string
  precio_venta: number
  impuesto_id: string | null
}

interface ClienteSimple {
  id: string
  razon_social: string
  numero_documento: string
  telefono?: string
}

interface Bodega { id: string; nombre: string }
interface FormaPago { id: string; descripcion: string }

interface LineaPOS {
  producto_id: string
  codigo: string
  descripcion: string
  precio_unitario: number
  cantidad: number
  impuesto_id: string | null
}

interface Props {
  bodegas: Bodega[]
  formasPago: FormaPago[]
}

const CF_PLACEHOLDER: ClienteSimple = { id: '', razon_social: 'Consumidor Final', numero_documento: '222222222222' }

export function PantallaPOS({ bodegas, formasPago }: Props) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState<ProductoSimple[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const [lineas, setLineas] = useState<LineaPOS[]>([])
  const [cliente, setCliente] = useState<ClienteSimple>(CF_PLACEHOLDER)
  const [cfReal, setCfReal] = useState<ClienteSimple>(CF_PLACEHOLDER)
  const [busqCliente, setBusqCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteSimple[]>([])
  const [loadingClientes, setLoadingClientes] = useState(false)
  const [showClientes, setShowClientes] = useState(false)
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '')
  const [formaPagoId, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/clientes?q=222222222222&limit=1&activo=true&select_mode=selector&include_total=false', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const found = data?.clientes?.[0]
        if (found) {
          setCfReal(found)
          setCliente(found)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setLoadingProductos(true)
        const params = new URLSearchParams({
          limit: '20',
          activo: 'true',
          select_mode: 'selector',
          include_total: 'false',
        })
        if (busqueda.trim()) params.set('q', busqueda.trim())

        const res = await fetch(`/api/productos?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No fue posible cargar productos')
        const data = await res.json()
        setProductos(Array.isArray(data?.productos) ? data.productos : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setProductos([])
        }
      } finally {
        setLoadingProductos(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [busqueda])

  useEffect(() => {
    if (!showClientes) return

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        setLoadingClientes(true)
        const params = new URLSearchParams({
          limit: '8',
          activo: 'true',
          select_mode: 'selector',
          include_total: 'false',
        })
        if (busqCliente.trim()) params.set('q', busqCliente.trim())

        const res = await fetch(`/api/clientes?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No fue posible cargar clientes')
        const data = await res.json()
        setClientes(Array.isArray(data?.clientes) ? data.clientes : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setClientes([])
        }
      } finally {
        setLoadingClientes(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [busqCliente, showClientes])

  const productosFiltrados = productos.slice(0, 20)
  const clientesFiltrados = [cfReal, ...clientes.filter((item) => item.id !== cfReal.id)]

  const agregarProducto = (producto: ProductoSimple) => {
    setLineas((prev) => {
      const idx = prev.findIndex((linea) => linea.producto_id === producto.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, {
        producto_id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        precio_unitario: producto.precio_venta,
        cantidad: 1,
        impuesto_id: producto.impuesto_id,
      }]
    })
    setBusqueda('')
    searchRef.current?.focus()
  }

  const cambiarCantidad = (idx: number, delta: number) => {
    setLineas((prev) => {
      const next = [...prev]
      const nueva = next[idx].cantidad + delta
      if (nueva <= 0) return prev.filter((_, index) => index !== idx)
      next[idx] = { ...next[idx], cantidad: nueva }
      return next
    })
  }

  const cambiarPrecio = (idx: number, precio: string) => {
    const val = parseFloat(precio)
    if (Number.isNaN(val) || val < 0) return
    setLineas((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], precio_unitario: val }
      return next
    })
  }

  const eliminar = (idx: number) => {
    setLineas((prev) => prev.filter((_, index) => index !== idx))
  }

  const subtotal = lineas.reduce((sum, linea) => sum + linea.cantidad * linea.precio_unitario, 0)
  const total = subtotal

  const cambio = efectivoRecibido
    ? Math.max(0, parseFloat(efectivoRecibido) - total)
    : 0

  const handleVenta = async () => {
    if (!lineas.length || !bodegaId || !formaPagoId) return
    if (!cliente.id) {
      alert('Seleccione un cliente.')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/ventas/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          bodega_id: bodegaId,
          forma_pago_id: formaPagoId,
          lineas: lineas.map((linea) => ({
            producto_id: linea.producto_id,
            descripcion: linea.descripcion,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio_unitario,
            descuento_porcentaje: 0,
            impuesto_id: linea.impuesto_id,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado({ id: data.id, numero: data.numero ?? data.id.slice(0, 8) })
      setLineas([])
      setEfectivoRecibido('')
      setCliente(cfReal)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (resultado) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">Venta registrada</p>
          <p className="mt-1 text-sm text-gray-500">Factura creada exitosamente</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/print/factura/${resultado.id}`)}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Imprimir ticket
          </button>
          <button
            onClick={() => setResultado(null)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nueva venta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por codigo o nombre..."
            autoFocus
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        <div className="grid flex-1 content-start gap-2 overflow-y-auto pb-2 sm:grid-cols-3 lg:grid-cols-4">
          {loadingProductos ? (
            <p className="col-span-full py-8 text-center text-sm text-gray-400">Cargando productos...</p>
          ) : productosFiltrados.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-gray-400">Sin productos</p>
          ) : (
            productosFiltrados.map((producto) => (
              <button
                key={producto.id}
                type="button"
                onClick={() => agregarProducto(producto)}
                className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-blue-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <span className="text-xs font-mono text-gray-400">{producto.codigo}</span>
                <span className="line-clamp-2 text-sm font-medium leading-tight text-gray-800 dark:text-gray-100">{producto.descripcion}</span>
                <span className="mt-auto text-sm font-bold text-blue-600">{formatCOP(producto.precio_venta)}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="relative border-b border-gray-100 p-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-gray-400" />
            <button
              type="button"
              onClick={() => setShowClientes((prev) => !prev)}
              className="flex-1 truncate text-left text-sm font-medium text-gray-700 dark:text-gray-200"
            >
              {cliente.razon_social}
            </button>
            {cliente.id !== cfReal.id && (
              <button type="button" onClick={() => setCliente(cfReal)}>
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>
          {showClientes && (
            <div className="absolute left-0 right-0 top-full z-30 rounded-b-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              <div className="border-b border-gray-100 p-2 dark:border-gray-700">
                <input
                  value={busqCliente}
                  onChange={(event) => setBusqCliente(event.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none dark:border-gray-600 dark:bg-gray-900"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {loadingClientes ? (
                  <p className="px-3 py-3 text-sm text-gray-400">Buscando...</p>
                ) : clientesFiltrados.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400">Sin clientes</p>
                ) : (
                  clientesFiltrados.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCliente(item)
                        setShowClientes(false)
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <p className="font-medium text-gray-800 dark:text-gray-100">{item.razon_social}</p>
                      <p className="text-xs text-gray-400">{item.numero_documento}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {lineas.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <ShoppingCart className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">Agrega productos para empezar</p>
            </div>
          ) : (
            lineas.map((linea, idx) => (
              <div key={linea.producto_id} className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="line-clamp-2 text-sm font-medium text-gray-800 dark:text-gray-100">{linea.descripcion}</p>
                    <p className="text-xs font-mono text-gray-400">{linea.codigo}</p>
                  </div>
                  <button type="button" onClick={() => eliminar(idx)}>
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => cambiarCantidad(idx, -1)} className="rounded-lg bg-gray-100 p-1.5 hover:bg-gray-200 dark:bg-gray-800">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">{linea.cantidad}</span>
                  <button type="button" onClick={() => cambiarCantidad(idx, 1)} className="rounded-lg bg-gray-100 p-1.5 hover:bg-gray-200 dark:bg-gray-800">
                    <Plus className="h-3.5 w-3.5" />
                  </button>

                  <input
                    type="number"
                    value={linea.precio_unitario}
                    onChange={(event) => cambiarPrecio(idx, event.target.value)}
                    className="ml-auto w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>

                <p className="text-right text-sm font-semibold text-blue-600">
                  {formatCOP(linea.cantidad * linea.precio_unitario)}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Bodega</span>
              <select
                value={bodegaId}
                onChange={(event) => setBodegaId(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              >
                {bodegas.map((bodega) => (
                  <option key={bodega.id} value={bodega.id}>
                    {bodega.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Forma de pago</span>
              <select
                value={formaPagoId}
                onChange={(event) => setFormaPagoId(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              >
                {formasPago.map((formaPago) => (
                  <option key={formaPago.id} value={formaPago.id}>
                    {formaPago.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-mono">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span>
              <span className="font-mono text-blue-600">{formatCOP(total)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <Calculator className="h-3.5 w-3.5" /> Efectivo recibido
            </label>
            <input
              type="number"
              value={efectivoRecibido}
              onChange={(event) => setEfectivoRecibido(event.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800"
            />
            {efectivoRecibido && (
              <p className="text-right text-sm text-green-600">
                Cambio: <span className="font-semibold">{formatCOP(cambio)}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleVenta}
            disabled={guardando || lineas.length === 0}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Finalizar venta'}
          </button>
        </div>
      </div>
    </div>
  )
}
