'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Producto, Bodega, Familia, Fabricante, Impuesto } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormProducto } from './FormProducto'
import { AjusteStock } from './AjusteStock'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import { hasLowStock, isLowStock } from '@/lib/utils/stock'
import {
  Package, Pencil, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  Layers, Warehouse, TrendingUp, AlertTriangle, Clock, Trash2,
} from 'lucide-react'

interface Props {
  producto:    Producto
  bodegas:     Bodega[]
  familias:    Familia[]
  fabricantes: Fabricante[]
  impuestos:   Impuesto[]
  movimientos: MovimientoRow[]
  canManage:   boolean
}

interface MovimientoRow {
  id:         string
  tipo:       string
  cantidad:   number
  notas?:     string | null
  created_at: string
  bodega?:    { nombre: string } | null
}

const TIPO_LABELS: Record<string, { label: string; icon: typeof ArrowUpCircle; color: string }> = {
  entrada_compra:    { label: 'Entrada compra',   icon: ArrowUpCircle,   color: 'text-green-600' },
  salida_venta:      { label: 'Salida venta',      icon: ArrowDownCircle, color: 'text-red-600' },
  ajuste_positivo:   { label: 'Ajuste entrada',   icon: ArrowUpCircle,   color: 'text-blue-600' },
  ajuste_negativo:   { label: 'Ajuste salida',    icon: ArrowDownCircle, color: 'text-orange-600' },
  ajuste_inventario: { label: 'Ajuste inventario', icon: RefreshCw,       color: 'text-purple-600' },
}

export function DetalleProducto({ producto, bodegas, familias, fabricantes, impuestos, movimientos, canManage }: Props) {
  const router = useRouter()
  const [productoActual, setProductoActual]   = useState(producto)
  const [movimientosActuales]                 = useState(movimientos)
  const [modalEditar, setModalEditar]   = useState(false)
  const [modalAjuste, setModalAjuste]   = useState(false)
  const [cargando, setCargando]         = useState(false)
  const [eliminando, setEliminando]     = useState(false)
  const [error, setError]               = useState('')

  const stockTotal = (productoActual.stock ?? []).reduce((s, st) => s + (st.cantidad ?? 0), 0)
  const stockBajo  = hasLowStock(productoActual.stock)
  const margen     = productoActual.precio_venta > 0
    ? Math.round(((productoActual.precio_venta - productoActual.precio_compra) / productoActual.precio_venta) * 100)
    : 0

  async function handleGuardar(datos: Record<string, unknown>) {
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/productos/${productoActual.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'Error') }
      setModalEditar(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  async function handleEliminar() {
    const confirmado = window.confirm(
          `Vas a eliminar "${productoActual.descripcion}". Si tiene movimientos, stock o documentos relacionados se desactivará en lugar de borrarse.`
    )
    if (!confirmado) return

    setEliminando(true)
    setError('')
    try {
      const res = await fetch(`/api/productos/${productoActual.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Error al eliminar producto')
      if (body?.message) window.alert(body.message)
      router.push('/productos')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEliminando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100">
            <Package className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{productoActual.descripcion}</h1>
              <Badge variant={productoActual.activo ? 'success' : 'danger'}>{productoActual.activo ? 'Activo' : 'Inactivo'}</Badge>
              {stockBajo && (
                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/25 dark:text-orange-300">
                  <AlertTriangle className="h-3 w-3" /> Stock bajo
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-mono text-gray-500 dark:text-gray-400">{productoActual.codigo}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(productoActual.familia as { nombre?: string } | null)?.nombre && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">{(productoActual.familia as { nombre: string }).nombre}</span>
              )}
              {(productoActual.fabricante as { nombre?: string } | null)?.nombre && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">{(productoActual.fabricante as { nombre: string }).nombre}</span>
              )}
              {productoActual.tiene_variantes && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                  <Layers className="h-3 w-3" /> Con variantes
                </span>
              )}
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalAjuste(true)}>
              <Warehouse className="h-4 w-4 mr-1" /> Ajustar stock
            </Button>
            <Button size="sm" onClick={() => setModalEditar(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleEliminar} disabled={eliminando}>
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar o desactivar
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Precio venta',   value: formatCOP(productoActual.precio_venta),  color: 'text-green-700 dark:text-green-300', bg: 'bg-green-50 dark:bg-green-900/20'  },
          { label: 'Precio compra',  value: formatCOP(productoActual.precio_compra), color: 'text-gray-700 dark:text-gray-300',  bg: 'bg-gray-50 dark:bg-gray-950'   },
          { label: 'Margen bruto',   value: `${margen}%`,                            color: margen >= 30 ? 'text-green-700 dark:text-green-300' : margen >= 15 ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-700 dark:text-red-300', bg: 'bg-white dark:bg-gray-900' },
          { label: 'Stock total',    value: `${stockTotal.toLocaleString('es-CO')} ${productoActual.unidad_medida ?? 'UND'}`, color: stockBajo ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300', bg: stockBajo ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-gray-100 dark:border-gray-800 ${k.bg} p-4`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock por bodega */}
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Warehouse className="h-4 w-4 text-blue-500" /> Stock por bodega
          </h3>
          {(productoActual.stock ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin registro de stock</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(productoActual.stock ?? []).map(s => {
                const bajo = isLowStock(s)
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
                    <span className="text-sm text-gray-700 dark:text-gray-200">{(s.bodega as { nombre?: string } | null)?.nombre ?? 'Bodega'}</span>
                    <div className="flex items-center gap-2">
                      {bajo && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                      <span className={`font-mono text-sm font-medium ${bajo ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        {s.cantidad.toLocaleString('es-CO')}
                      </span>
                      {s.cantidad_minima > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">/ mín {s.cantidad_minima}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Variantes */}
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Layers className="h-4 w-4 text-purple-500" /> Variantes
          </h3>
          {!((productoActual as any).producto_variantes ?? []).length ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {productoActual.tiene_variantes ? 'Sin variantes registradas' : 'Producto sin variantes'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {((productoActual as any).producto_variantes ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm dark:bg-gray-800/70">
                  <span className="text-gray-700 dark:text-gray-200">{[v.talla, v.color].filter(Boolean).join(' / ') || v.sku}</span>
                  {v.precio_venta && <span className="font-mono text-gray-500 dark:text-gray-400">{formatCOP(v.precio_venta)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info adicional */}
        <div className={cn(cardCls, 'p-5')}>
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <TrendingUp className="h-4 w-4 text-green-500" /> Información
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            {productoActual.codigo_barras && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Cód. barras</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-200">{productoActual.codigo_barras}</dd>
              </div>
            )}
            {productoActual.unidad_medida && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Unidad</dt>
                <dd className="text-gray-700 dark:text-gray-200">{productoActual.unidad_medida}</dd>
              </div>
            )}
            {(productoActual.impuesto as { porcentaje?: number } | null)?.porcentaje !== undefined && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">IVA</dt>
                <dd className="text-gray-700 dark:text-gray-200">{(productoActual.impuesto as { porcentaje: number }).porcentaje}%</dd>
              </div>
            )}
            {productoActual.precio_venta2 !== null && productoActual.precio_venta2 !== undefined && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">P. mayorista</dt>
                <dd className="text-gray-700 dark:text-gray-200">{formatCOP(productoActual.precio_venta2)}</dd>
              </div>
            )}
            {productoActual.created_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Creado</dt>
                <dd className="text-gray-700 dark:text-gray-200">{formatFecha(productoActual.created_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Movimientos */}
      <div className={cn(cardCls, 'p-5')}>
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Clock className="h-4 w-4 text-gray-400" /> Últimos movimientos de inventario
        </h3>
        {movimientosActuales.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Sin movimientos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Fecha</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Tipo</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Bodega</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Cantidad</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {movimientosActuales.map(m => {
                  const meta = TIPO_LABELS[m.tipo] ?? { label: m.tipo, icon: RefreshCw, color: 'text-gray-500 dark:text-gray-400 dark:text-gray-500' }
                  const Icon = meta.icon
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{formatFecha(m.created_at)}</td>
                      <td className="py-2">
                        <span className={`flex items-center gap-1 ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{m.bodega?.nombre ?? '—'}</td>
                      <td className={`py-2 text-right font-mono font-medium ${m.cantidad >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {m.cantidad >= 0 ? '+' : ''}{m.cantidad.toLocaleString('es-CO')}
                      </td>
                      <td className="max-w-[150px] truncate py-2 text-gray-400 dark:text-gray-500">{m.notas ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar */}
      <Modal open={modalEditar} onClose={() => setModalEditar(false)} titulo="Editar producto" size="xl">
        <FormProducto
          inicial={productoActual}
          familias={familias}
          fabricantes={fabricantes}
          impuestos={impuestos}
          bodegas={bodegas}
          canSetInitialStock={false}
          onGuardar={handleGuardar}
          onCancelar={() => setModalEditar(false)}
          cargando={cargando}
        />
      </Modal>

      {/* Modal ajuste */}
          <Modal open={modalAjuste} onClose={() => setModalAjuste(false)} titulo="Ajustar stock" size="sm">
        <AjusteStock
          producto={productoActual}
          bodegas={bodegas}
          onDone={({ bodega_id, stock_final }) => {
            setProductoActual((prev) => ({
              ...prev,
              stock: (prev.stock ?? []).some((stock) => stock.bodega_id === bodega_id)
                ? (prev.stock ?? []).map((stock) => (
                  stock.bodega_id === bodega_id
                    ? { ...stock, cantidad: stock_final }
                    : stock
                ))
                : [
                  ...(prev.stock ?? []),
                  {
                    id: `local-${bodega_id}`,
                    producto_id: prev.id,
                    variante_id: null,
                    bodega_id,
                    cantidad: stock_final,
                    cantidad_minima: 0,
                    cantidad_maxima: null,
                    updated_at: new Date().toISOString(),
                    bodega: bodegas.find((bodega) => bodega.id === bodega_id) ?? null,
                  } as any,
                ],
            }))
            setModalAjuste(false)
            router.refresh()
          }}
          onCancel={() => setModalAjuste(false)}
        />
      </Modal>
    </div>
  )
}
