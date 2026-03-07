'use client'

import { useState, useRef, useCallback } from 'react'
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
  productos: ProductoSimple[]
  formasPago: FormaPago[]
  clientes: ClienteSimple[]
}

const CONSUMIDOR_FINAL = { id: '__CF__', razon_social: 'Consumidor Final', numero_documento: '222222222222' }

export function PantallaPOS({ bodegas, productos, formasPago, clientes }: Props) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [lineas, setLineas] = useState<LineaPOS[]>([])
  const [cliente, setCliente] = useState<ClienteSimple>(CONSUMIDOR_FINAL)
  const [busqCliente, setBusqCliente] = useState('')
  const [showClientes, setShowClientes] = useState(false)
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '')
  const [formaPagoId, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [efectivoRecibido, setEfectivoRecibido] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<{ id: string; numero: string } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const todosMasConsumidor = [CONSUMIDOR_FINAL, ...clientes.filter(c => c.id !== '__CF__')]

  const clientesFiltrados = busqCliente
    ? todosMasConsumidor.filter(c =>
        (c.razon_social ?? '').toLowerCase().includes(busqCliente.toLowerCase()) ||
        (c.numero_documento ?? '').includes(busqCliente)
      )
    : todosMasConsumidor.slice(0, 8)

  const productosFiltrados = busqueda
    ? productos.filter(p =>
        (p.descripcion ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 20)
    : productos.slice(0, 20)

  const agregarProducto = useCallback((p: ProductoSimple) => {
    setLineas(prev => {
      const idx = prev.findIndex(l => l.producto_id === p.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + 1 }
        return next
      }
      return [...prev, {
        producto_id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        precio_unitario: p.precio_venta,
        cantidad: 1,
        impuesto_id: p.impuesto_id,
      }]
    })
    setBusqueda('')
    searchRef.current?.focus()
  }, [])

  const cambiarCantidad = (idx: number, delta: number) => {
    setLineas(prev => {
      const next = [...prev]
      const nueva = next[idx].cantidad + delta
      if (nueva <= 0) return prev.filter((_, i) => i !== idx)
      next[idx] = { ...next[idx], cantidad: nueva }
      return next
    })
  }

  const cambiarPrecio = (idx: number, precio: string) => {
    const val = parseFloat(precio)
    if (isNaN(val) || val < 0) return
    setLineas(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], precio_unitario: val }
      return next
    })
  }

  const eliminar = (idx: number) => setLineas(prev => prev.filter((_, i) => i !== idx))

  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)
  const total = subtotal // IVA se maneja en la función SQL

  const cambio = efectivoRecibido
    ? Math.max(0, parseFloat(efectivoRecibido) - total)
    : 0

  const handleVenta = async () => {
    if (!lineas.length || !bodegaId || !formaPagoId) return
    if (cliente.id === '__CF__') {
      alert('Seleccione un cliente. Si la venta es a consumidor final, créelo primero en el módulo de Clientes con NIT 222222222222.')
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
          lineas: lineas.map(l => ({
            producto_id: l.producto_id,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento_porcentaje: 0,
            impuesto_id: l.impuesto_id,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResultado({ id: data.id, numero: data.numero ?? data.id.slice(0, 8) })
      setLineas([])
      setEfectivoRecibido('')
      setCliente(CONSUMIDOR_FINAL)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-white">Venta registrada</p>
          <p className="text-sm text-gray-500 mt-1">Factura creada exitosamente</p>
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
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Panel izquierdo: productos ────────────────────────── */}
      <div className="flex flex-col gap-3 flex-1 min-w-0">
        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={searchRef}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre..."
            autoFocus
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Grid de productos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto flex-1 pb-2 content-start">
          {productosFiltrados.map(p => (
            <button
              key={p.id}
              onClick={() => agregarProducto(p)}
              className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-400 hover:shadow-sm transition-all dark:bg-gray-800 dark:border-gray-700"
            >
              <span className="text-xs font-mono text-gray-400">{p.codigo}</span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">{p.descripcion}</span>
              <span className="text-sm font-bold text-blue-600 mt-auto">{formatCOP(p.precio_venta)}</span>
            </button>
          ))}
          {productosFiltrados.length === 0 && (
            <p className="col-span-full text-sm text-gray-400 text-center py-8">Sin productos</p>
          )}
        </div>
      </div>

      {/* ── Panel derecho: carrito ────────────────────────────── */}
      <div className="flex flex-col w-80 shrink-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        {/* Cliente */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800 relative">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            <button
              onClick={() => setShowClientes(p => !p)}
              className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-200 truncate"
            >
              {cliente.razon_social}
            </button>
            {cliente.id !== '__CF__' && (
              <button onClick={() => setCliente(CONSUMIDOR_FINAL)}>
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>
          {showClientes && (
            <div className="absolute left-0 right-0 top-full z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-xl shadow-lg">
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <input
                  value={busqCliente}
                  onChange={e => setBusqCliente(e.target.value)}
                  placeholder="Buscar cliente..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:bg-gray-900 dark:border-gray-600 focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {clientesFiltrados.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCliente(c); setShowClientes(false); setBusqCliente('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="font-medium">{c.razon_social}</span>
                    <span className="text-xs text-gray-400 ml-2">{c.numero_documento}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Líneas */}
        <div className="flex-1 overflow-y-auto">
          {lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-300">
              <ShoppingCart className="h-12 w-12" />
              <p className="text-sm">Carrito vacío</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {lineas.map((l, idx) => (
                <div key={idx} className="flex items-start gap-2 px-3 py-2 border-b border-gray-50 dark:border-gray-800">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-mono">{l.codigo}</p>
                    <p className="text-sm leading-tight text-gray-800 dark:text-gray-200">{l.descripcion}</p>
                    <input
                      type="number"
                      value={l.precio_unitario}
                      onChange={e => cambiarPrecio(idx, e.target.value)}
                      className="mt-1 w-24 rounded border border-gray-200 px-1.5 py-0.5 text-xs dark:bg-gray-800 dark:border-gray-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button onClick={() => eliminar(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => cambiarCantidad(idx, -1)} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{l.cantidad}</span>
                      <button onClick={() => cambiarCantidad(idx, 1)} className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      {formatCOP(l.cantidad * l.precio_unitario)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totales y pago */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3 flex flex-col gap-3">
          {/* Config */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Bodega</label>
              <select
                value={bodegaId}
                onChange={e => setBodegaId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600"
              >
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Forma de pago</label>
              <select
                value={formaPagoId}
                onChange={e => setFormaPagoId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600"
              >
                {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
              </select>
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Total</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCOP(total)}</span>
          </div>

          {/* Efectivo recibido */}
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="number"
              value={efectivoRecibido}
              onChange={e => setEfectivoRecibido(e.target.value)}
              placeholder="Efectivo recibido..."
              className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-600 focus:outline-none"
            />
          </div>
          {efectivoRecibido && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Cambio</span>
              <span className={`font-semibold ${cambio >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {formatCOP(cambio)}
              </span>
            </div>
          )}

          <button
            onClick={handleVenta}
            disabled={!lineas.length || guardando}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {guardando ? 'Guardando...' : `Cobrar ${formatCOP(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
