'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, CheckCircle, XCircle, AlertTriangle, Info, Plus, Minus } from 'lucide-react'
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

function parseCantidad(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

interface ResultadoAjuste {
  resumen: string
  detalles: string[]
  ok: number
  err: number
  sinCambio: number
}

export function AjusteInventarioForm({ bodegas }: Props) {
  const router = useRouter()
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [productosFiltrados, setProductosFiltrados] = useState<ProductoSimple[]>([])
  const [loadingBusqueda, setLoadingBusqueda] = useState(false)
  const [filas, setFilas] = useState<FilaAjuste[]>([])
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoAjuste | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sinBodegas = bodegas.length === 0

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      const q = busqueda.trim()
      if (!q || !bodegaId || sinBodegas) {
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
  }, [bodegaId, busqueda, sinBodegas])

  const agregarProducto = (producto: ProductoSimple) => {
    if (!bodegaId || sinBodegas) {
      setError('No se puede agregar productos al ajuste porque no hay una bodega disponible.')
      return
    }
    if (filas.some((fila) => fila.producto_id === producto.id)) return
    setError(null)
    setFilas((prev) => [...prev, {
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      unidad_medida: producto.unidad_medida,
      stock: Array.isArray(producto.stock) ? producto.stock : [],
      cantidad_fisica: String(
        (Array.isArray(producto.stock) ? producto.stock : [])
          .filter((stock) => stock.bodega_id === bodegaId)
          .reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
      ),
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

  const getCantidadObjetivo = (fila: FilaAjuste) => parseCantidad(fila.cantidad_fisica)

  const handleGuardar = async () => {
    if (sinBodegas) {
      setError('No se puede realizar el ajuste porque la empresa no tiene bodegas configuradas.')
      return
    }
    if (!bodegaId) {
      setError('Selecciona una bodega para aplicar el ajuste.')
      return
    }

    const filasValidas = filas.filter((fila) => {
      const cantidadObjetivo = getCantidadObjetivo(fila)
      return cantidadObjetivo != null && cantidadObjetivo >= 0
    })
    if (!filasValidas.length) return

    setGuardando(true)
    setError(null)
    let ok = 0
    let sinCambio = 0
    let err = 0
    const detalles: string[] = []

    try {
      for (const fila of filasValidas) {
        const cantidadObjetivo = getCantidadObjetivo(fila)
        if (cantidadObjetivo == null || cantidadObjetivo < 0) {
          err += 1
          detalles.push(`${fila.codigo}: no se guardó porque la cantidad final es inválida.`)
          continue
        }

        const res = await fetch('/api/inventario/ajuste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: fila.producto_id,
            bodega_id: bodegaId,
            tipo: 'ajuste_inventario',
            stock_objetivo: cantidadObjetivo,
            notas: fila.notas || 'Ajuste manual por conteo físico',
          }),
        })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.applied === false) {
            sinCambio += 1
            detalles.push(`${fila.codigo}: sin cambios, ya estaba en ${Number(data?.stock_actual ?? cantidadObjetivo).toLocaleString('es-CO')} ${fila.unidad_medida ?? 'UND'}.`)
          } else {
            ok += 1
            const anterior = Number(data?.stock_actual ?? getStockActual(fila))
            const final = Number(data?.stock_final ?? cantidadObjetivo)
            const delta = Number(data?.delta ?? (final - anterior))
            detalles.push(`${fila.codigo}: guardado correctamente, quedó en ${final.toLocaleString('es-CO')} ${fila.unidad_medida ?? 'UND'} (${delta >= 0 ? '+' : ''}${delta.toLocaleString('es-CO')}).`)
          }
        } else {
          err += 1
          const body = await res.json().catch(() => null)
          detalles.push(`${fila.codigo}: no se guardó. ${body?.error ?? 'Error al aplicar ajuste.'}`)
        }
      }
      const total = ok + sinCambio + err
      const resumen =
        err > 0 && ok === 0
          ? `No se pudo aplicar ningún ajuste (${err} error${err > 1 ? 'es' : ''})`
          : ok > 0 && err > 0
            ? `Se aplicaron ${ok} de ${total} ajustes (${err} con error)`
            : ok > 0
              ? `${ok} ajuste(s) aplicado(s) correctamente`
              : `Sin cambios — el stock ya coincide con el conteo físico`
      setResultado({ resumen, detalles, ok, err, sinCambio })
      setFilas([])
    } finally {
      setGuardando(false)
    }
  }

  if (resultado) {
    const ResultIcon =
      resultado.ok > 0 && resultado.err === 0 ? CheckCircle
      : resultado.ok > 0 && resultado.err > 0 ? AlertTriangle
      : resultado.err > 0 ? XCircle
      : Info
    const iconColor =
      resultado.ok > 0 && resultado.err === 0 ? 'text-green-500'
      : resultado.ok > 0 && resultado.err > 0 ? 'text-amber-500'
      : resultado.err > 0 ? 'text-red-500'
      : 'text-blue-500'
    const tienePeriodoError = resultado.detalles.some((d) => d.includes('periodo contable'))

    return (
        <div className="flex flex-col items-center gap-4 py-12">
          <ResultIcon className={`h-12 w-12 ${iconColor}`} />
          <p className="text-lg font-semibold text-gray-800 dark:text-white">{resultado.resumen}</p>
          {tienePeriodoError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              <Link href="/contabilidad/periodos" className="font-semibold underline underline-offset-2">
                Configura los periodos contables
              </Link>
              {' '}para poder registrar movimientos.
            </div>
          )}
          {resultado.detalles.length > 0 && (
            <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              <p className="mb-2 font-medium">Resultado por producto</p>
              <ul className="space-y-1">
                {resultado.detalles.map((detalle) => (
                  <li key={detalle}>{detalle}</li>
                ))}
              </ul>
            </div>
          )}
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
      {sinBodegas && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          No se puede realizar el ajuste porque la empresa no tiene bodegas configuradas.
          {' '}
          <Link href="/configuracion/bodegas" className="font-semibold underline underline-offset-2">
            Crea una bodega en Configuración &gt; Bodegas
          </Link>
          {' '}
          y vuelve a intentarlo.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Bodega</label>
        {sinBodegas ? (
          <div className="rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Sin bodegas configuradas
          </div>
        ) : (
          <select
            value={bodegaId}
            onChange={(event) => {
              setBodegaId(event.target.value)
              setError(null)
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <option value="">Selecciona una bodega</option>
            {bodegas.map((bodega) => (
              <option key={bodega.id} value={bodega.id}>
                {bodega.nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={`${cardCls} p-4`}>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Agregar producto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder={sinBodegas ? 'Primero configura una bodega' : 'Buscar por codigo o nombre...'}
            disabled={sinBodegas || !bodegaId}
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Conteo físico final</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filas.map((fila, idx) => {
                const stockActual = getStockActual(fila)
                const cantidadObjetivo = getCantidadObjetivo(fila)
                const diferencia = cantidadObjetivo == null ? null : cantidadObjetivo - stockActual

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
                        onClick={() => actualizarFila(
                          idx,
                          'cantidad_fisica',
                          String(Math.max(0, (parseCantidad(fila.cantidad_fisica) ?? stockActual) - 1))
                        )}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/35"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={fila.cantidad_fisica}
                        onChange={(event) => actualizarFila(idx, 'cantidad_fisica', event.target.value)}
                        placeholder={String(stockActual)}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-center text-sm text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => actualizarFila(
                          idx,
                          'cantidad_fisica',
                          String((parseCantidad(fila.cantidad_fisica) ?? stockActual) + 1)
                        )}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/35"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-center text-xs text-gray-400">
                      {cantidadObjetivo == null
                        ? 'Sin cambio'
                        : diferencia === 0
                          ? 'Sin cambio'
                          : diferencia != null && diferencia > 0
                            ? `Ajuste +${diferencia.toLocaleString('es-CO')}`
                            : `Ajuste ${(diferencia ?? 0).toLocaleString('es-CO')}`}
                    </p>
                    <p className="mt-0.5 text-center text-[11px] text-gray-400">
                      Se guardará el stock final en esta bodega.
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
            disabled={guardando || sinBodegas || !bodegaId}
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Aplicando...' : `Aplicar ajuste (${filas.filter((fila) => {
              const cantidadObjetivo = getCantidadObjetivo(fila)
              return cantidadObjetivo != null && cantidadObjetivo >= 0
            }).length} productos)`}
          </button>
        </div>
      )}
    </div>
  )
}
