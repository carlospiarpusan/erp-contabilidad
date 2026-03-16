'use client'

import { useState, useMemo } from 'react'
import { Search, FileText } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface Bodega {
  id: string
  nombre: string
}

interface Producto {
  id: string
  codigo: string
  descripcion: string
}

interface Movimiento {
  fecha: string
  tipo: string
  bodega_nombre: string
  documento_numero: string | null
  cantidad: number
  stock_antes: number
  stock_despues: number
}

interface Props {
  bodegas: Bodega[]
  productos: Producto[]
}

const TIPO_LABELS: Record<string, string> = {
  entrada_compra: 'Compra',
  salida_venta: 'Venta',
  salida_remision: 'Remisión',
  entrada_devolucion: 'Devolución',
  ajuste_positivo: 'Ajuste +',
  ajuste_negativo: 'Ajuste \u2212',
  traslado_entrada: 'Traslado entrada',
  traslado_salida: 'Traslado salida',
}

export function KardexProducto({ bodegas, productos }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [bodegaId, setBodegaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consultado, setConsultado] = useState(false)

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    return productos
      .filter(
        (p) =>
          p.codigo.toLowerCase().includes(q) ||
          p.descripcion.toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [busqueda, productos])

  const seleccionarProducto = (producto: Producto) => {
    setProductoSeleccionado(producto)
    setBusqueda(`${producto.codigo} — ${producto.descripcion}`)
    setMostrarSugerencias(false)
  }

  const consultar = async () => {
    if (!productoSeleccionado) return

    setLoading(true)
    setError(null)
    setConsultado(true)

    try {
      const params = new URLSearchParams({ producto_id: productoSeleccionado.id })
      if (bodegaId) params.set('bodega_id', bodegaId)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)

      const res = await fetch(`/api/inventario/kardex?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Error al consultar kardex')
      }

      const data = await res.json()
      setMovimientos(Array.isArray(data?.movimientos) ? data.movimientos : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setMovimientos([])
    } finally {
      setLoading(false)
    }
  }

  const limpiar = () => {
    setProductoSeleccionado(null)
    setBusqueda('')
    setBodegaId('')
    setDesde('')
    setHasta('')
    setMovimientos([])
    setError(null)
    setConsultado(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className={`${cardCls} p-4`}>
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-gray-400">
          Filtros de búsqueda
        </p>

        {/* Producto */}
        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Producto <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value)
                setMostrarSugerencias(true)
                if (productoSeleccionado) setProductoSeleccionado(null)
              }}
              onFocus={() => setMostrarSugerencias(true)}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => setMostrarSugerencias(false), 200)
              }}
              placeholder="Buscar por código o nombre..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {mostrarSugerencias && productosFiltrados.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                {productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    onMouseDown={() => seleccionarProducto(producto)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <span className="mr-2 font-mono text-xs text-gray-400">{producto.codigo}</span>
                    {producto.descripcion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bodega + Fechas */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bodega
            </label>
            <select
              value={bodegaId}
              onChange={(e) => setBodegaId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">Todas</option>
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Desde
            </label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Botones */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={consultar}
            disabled={!productoSeleccionado || loading}
            className="rounded-xl bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Consultando...' : 'Consultar'}
          </button>
          <button
            type="button"
            onClick={limpiar}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/70"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`${cardCls} border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20`}>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Tabla de resultados */}
      {consultado && !error && (
        <div className={`overflow-hidden ${cardCls}`}>
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
              Movimientos
              {productoSeleccionado && (
                <span className="ml-2 normal-case tracking-normal text-gray-600 dark:text-gray-300">
                  — {productoSeleccionado.codigo} {productoSeleccionado.descripcion}
                </span>
              )}
            </p>
          </div>

          {movimientos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No se encontraron movimientos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Bodega</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Documento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Cantidad</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Stock Antes</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Stock Después</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {movimientos.map((mov, idx) => {
                    const isPositive = mov.cantidad > 0
                    const tipoLabel = TIPO_LABELS[mov.tipo] ?? mov.tipo

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                          {new Intl.DateTimeFormat('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(mov.fecha))}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                          {tipoLabel}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                          {mov.bodega_nombre}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                          {mov.documento_numero ?? '—'}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-semibold ${
                            isPositive
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {mov.cantidad.toLocaleString('es-CO')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {mov.stock_antes.toLocaleString('es-CO')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-gray-800 dark:text-gray-200">
                          {mov.stock_despues.toLocaleString('es-CO')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
