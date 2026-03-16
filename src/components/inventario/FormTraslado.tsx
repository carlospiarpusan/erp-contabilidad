'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Trash2, Plus, CheckCircle } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface Bodega {
  id: string
  nombre: string
}

interface ProductoSimple {
  id: string
  codigo: string
  descripcion: string
}

interface LineaTraslado {
  producto_id: string
  codigo: string
  descripcion: string
  cantidad: string
}

interface Props {
  bodegas: Bodega[]
}

export function FormTraslado({ bodegas }: Props) {
  const router = useRouter()
  const [bodegaOrigenId, setBodegaOrigenId] = useState(bodegas[0]?.id ?? '')
  const [bodegaDestinoId, setBodegaDestinoId] = useState(bodegas[1]?.id ?? '')
  const [observaciones, setObservaciones] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [productosFiltrados, setProductosFiltrados] = useState<ProductoSimple[]>([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [lineas, setLineas] = useState<LineaTraslado[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bodegasIguales = bodegaOrigenId === bodegaDestinoId

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      const q = busqueda.trim()
      if (!q) {
        setProductosFiltrados([])
        setLoadingBusqueda(false)
        return
      }

      try {
        setLoadingBusqueda(true)
        const params = new URLSearchParams({
          q,
          limit: '10',
          activo: 'true',
          include_total: 'false',
          select_mode: 'selector',
        })
        const res = await fetch(`/api/productos?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No fue posible buscar productos')
        const data = await res.json()
        setProductosFiltrados(Array.isArray(data?.productos) ? data.productos : [])
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setProductosFiltrados([])
        }
      } finally {
        setLoadingBusqueda(false)
      }
    }, 250)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [busqueda])

  const agregarProducto = (producto: ProductoSimple) => {
    if (lineas.some((l) => l.producto_id === producto.id)) return
    setLineas((prev) => [...prev, {
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      cantidad: '1',
    }])
    setBusqueda('')
    setProductosFiltrados([])
  }

  const actualizarCantidad = (idx: number, valor: string) => {
    setLineas((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], cantidad: valor }
      return next
    })
  }

  const eliminarLinea = (idx: number) => {
    setLineas((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    setError(null)

    if (bodegasIguales) {
      setError('Las bodegas de origen y destino deben ser diferentes')
      return
    }

    const lineasValidas = lineas.filter((l) => {
      const cant = parseFloat(l.cantidad)
      return !Number.isNaN(cant) && cant > 0
    })

    if (lineasValidas.length === 0) {
      setError('Agrega al menos un producto con cantidad valida')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/inventario/traslados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodega_origen_id: bodegaOrigenId,
          bodega_destino_id: bodegaDestinoId,
          observaciones,
          lineas: lineasValidas.map((l) => ({
            producto_id: l.producto_id,
            cantidad: parseFloat(l.cantidad),
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al crear el traslado')
      }

      router.push('/inventario/traslados')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bodegas */}
      <div className={`${cardCls} p-4`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bodega origen</label>
            <select
              value={bodegaOrigenId}
              onChange={(e) => setBodegaOrigenId(e.target.value)}
              className="w-full rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bodega destino</label>
            <select
              value={bodegaDestinoId}
              onChange={(e) => setBodegaDestinoId(e.target.value)}
              className="w-full rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              {bodegas.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        {bodegasIguales && (
          <p className="mt-2 text-xs text-red-500">Las bodegas de origen y destino deben ser diferentes</p>
        )}
      </div>

      {/* Buscar producto */}
      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-[11px] uppercase tracking-wider font-semibold text-gray-500">Agregar producto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por codigo o nombre..."
            className="w-full rounded-xl border border-gray-100 py-2 pl-9 pr-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          {(loadingBusqueda || productosFiltrados.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
              {loadingBusqueda ? (
                <div className="px-3 py-2 text-sm text-gray-500">Buscando...</div>
              ) : (
                productosFiltrados.map((producto) => (
                  <button
                    key={producto.id}
                    type="button"
                    onClick={() => agregarProducto(producto)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <span className="mr-2 text-xs font-mono text-gray-400">{producto.codigo}</span>
                    {producto.descripcion}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lineas del traslado */}
      {lineas.length > 0 && (
        <div className={`overflow-hidden ${cardCls}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Codigo</th>
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-gray-500">Descripcion</th>
                <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-semibold text-gray-500">Cantidad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {lineas.map((linea, idx) => (
                <tr key={linea.producto_id}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{linea.codigo}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{linea.descripcion}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      value={linea.cantidad}
                      onChange={(e) => actualizarCantidad(idx, e.target.value)}
                      className="mx-auto block w-20 rounded-xl border border-gray-100 px-2 py-1.5 text-center text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => eliminarLinea(idx)}
                      className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observaciones */}
      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-[11px] uppercase tracking-wider font-semibold text-gray-500">Observaciones</label>
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          placeholder="Notas opcionales sobre el traslado..."
          rows={3}
          className="w-full rounded-xl border border-gray-100 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push('/inventario/traslados')}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/70"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={guardando || lineas.length === 0 || bodegasIguales}
          className="rounded-xl bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm shadow-teal-600/20"
        >
          {guardando ? 'Procesando...' : 'Crear traslado'}
        </button>
      </div>
    </div>
  )
}
