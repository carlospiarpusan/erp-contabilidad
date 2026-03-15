'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CheckCircle, Plus, Minus } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface ProductoSimple {
  id: string
  codigo: string
  descripcion: string
  unidad_medida?: string
  stock?: Array<{
    bodega_id: string
    cantidad: number
  }>
}

interface Bodega {
  id: string
  nombre: string
}

interface Props {
  bodegas: Bodega[]
}

interface FilaAjuste {
  producto_id: string
  codigo: string
  descripcion: string
  unidad_medida?: string
  stock: Array<{
    bodega_id: string
    cantidad: number
  }>
  cantidad_fisica: string
  notas: string
}

export function AjusteInventarioForm({ bodegas }: Props) {
  const router = useRouter()
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [productosFiltrados, setProductosFiltrados] = useState<ProductoSimple[]>([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [filas, setFilas] = useState<FilaAjuste[]>([])
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

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
        })
        const res = await fetch(`/api/productos?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('No fue posible buscar productos')
        const data = await res.json()
        setProductosFiltrados(Array.isArray(data?.productos) ? data.productos : [])
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
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
    if (filas.some((fila) => fila.producto_id === producto.id)) return
    setFilas((prev) => [...prev, {
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      unidad_medida: producto.unidad_medida,
      stock: Array.isArray(producto.stock) ? producto.stock : [],
      cantidad_fisica: '',
      notas: '',
    }])
    setBusqueda('')
    setProductosFiltrados([])
  }

  const actualizarFila = (idx: number, campo: keyof FilaAjuste, valor: string) => {
    setFilas((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [campo]: valor }
      return next
    })
  }

  const eliminarFila = (idx: number) => {
    setFilas((prev) => prev.filter((_, index) => index !== idx))
  }

  const getStockActual = (fila: FilaAjuste) => {
    return fila.stock
      .filter((stock) => stock.bodega_id === bodegaId)
      .reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
  }

  const handleGuardar = async () => {
    const filasValidas = filas.filter((fila) => fila.cantidad_fisica !== '' && !Number.isNaN(parseFloat(fila.cantidad_fisica)))
    if (!filasValidas.length || !bodegaId) return

    setGuardando(true)
    let ok = 0
    let err = 0

    try {
      for (const fila of filasValidas) {
        const cantidad = parseFloat(fila.cantidad_fisica)
        const tipo = cantidad < 0 ? 'ajuste_negativo' : 'ajuste_positivo'
        const res = await fetch('/api/inventario/ajuste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: fila.producto_id,
            bodega_id: bodegaId,
            tipo,
            cantidad: Math.abs(cantidad),
            notas: fila.notas || `Ajuste manual${cantidad < 0 ? ' (descuento)' : ' (incremento)'}`,
          }),
        })
        if (res.ok) ok += 1
        else err += 1
      }
      setResultado(`${ok} ajuste(s) aplicado(s)${err > 0 ? `, ${err} error(es)` : ''}`)
      setFilas([])
    } finally {
      setGuardando(false)
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-800 dark:text-white">{resultado}</p>
        <div className="flex gap-3">
          <button onClick={() => router.push('/productos')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/70">
            Ver productos
          </button>
          <button onClick={() => setResultado(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Nuevo ajuste
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Bodega</label>
        <select
          value={bodegaId}
          onChange={(event) => setBodegaId(event.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        >
          {bodegas.map((bodega) => (
            <option key={bodega.id} value={bodega.id}>
              {bodega.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Agregar producto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por codigo o nombre..."
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
          {(loadingBusqueda || productosFiltrados.length > 0) && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
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

      {filas.length > 0 && (
        <div className={`overflow-hidden ${cardCls}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Stock actual</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Cantidad ajuste</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filas.map((fila, idx) => {
                const stockActual = getStockActual(fila)

                return (
                <tr key={fila.producto_id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{fila.descripcion}</p>
                    <p className="font-mono text-xs text-gray-400">{fila.codigo}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {stockActual.toLocaleString('es-CO')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {fila.unidad_medida ?? 'UND'} en {bodegas.find((bodega) => bodega.id === bodegaId)?.nombre ?? 'bodega'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => actualizarFila(idx, 'cantidad_fisica', String((parseFloat(fila.cantidad_fisica) || 0) - 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/35"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        value={fila.cantidad_fisica}
                        onChange={(event) => actualizarFila(idx, 'cantidad_fisica', event.target.value)}
                        placeholder="0"
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => actualizarFila(idx, 'cantidad_fisica', String((parseFloat(fila.cantidad_fisica) || 0) + 1))}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/35"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-center text-xs text-gray-400">
                      {fila.cantidad_fisica !== '' && parseFloat(fila.cantidad_fisica) !== 0
                        ? parseFloat(fila.cantidad_fisica) > 0 ? 'Entrada' : 'Salida'
                        : 'Sin cambio'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={fila.notas}
                      onChange={(event) => actualizarFila(idx, 'notas', event.target.value)}
                      placeholder="Motivo (opcional)"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => eliminarFila(idx)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-300">X</button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}

      {filas.length > 0 && (
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setFilas([])} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800/70">
            Limpiar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Aplicando...' : `Aplicar ajuste (${filas.filter((fila) => fila.cantidad_fisica !== '' && !Number.isNaN(parseFloat(fila.cantidad_fisica))).length} productos)`}
          </button>
        </div>
      )}
    </div>
  )
}
