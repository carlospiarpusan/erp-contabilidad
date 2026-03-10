'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Producto, Bodega, Familia, Fabricante, Impuesto } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FormProducto } from './FormProducto'
import { AjusteStock } from './AjusteStock'
import { formatCOP, formatFecha } from '@/utils/cn'
import { hasLowStock, isLowStock } from '@/lib/utils/stock'
import {
  Package, Pencil, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  Layers, Warehouse, TrendingUp, AlertTriangle, Clock,
} from 'lucide-react'

interface Props {
  producto:    Producto
  bodegas:     Bodega[]
  familias:    Familia[]
  fabricantes: Fabricante[]
  impuestos:   Impuesto[]
  movimientos: MovimientoRow[]
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

export function DetalleProducto({ producto, bodegas, familias, fabricantes, impuestos, movimientos }: Props) {
  const router = useRouter()
  const [modalEditar, setModalEditar]   = useState(false)
  const [modalAjuste, setModalAjuste]   = useState(false)
  const [cargando, setCargando]         = useState(false)
  const [error, setError]               = useState('')

  const stockTotal = (producto.stock ?? []).reduce((s, st) => s + (st.cantidad ?? 0), 0)
  const stockBajo  = hasLowStock(producto.stock)
  const margen     = producto.precio_venta > 0
    ? Math.round(((producto.precio_venta - producto.precio_compra) / producto.precio_venta) * 100)
    : 0

  async function handleGuardar(datos: Record<string, unknown>) {
    setCargando(true); setError('')
    try {
      const res = await fetch(`/api/productos/${producto.id}`, {
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100">
            <Package className="h-7 w-7 text-orange-600" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{producto.descripcion}</h1>
              <Badge variant={producto.activo ? 'success' : 'danger'}>{producto.activo ? 'Activo' : 'Inactivo'}</Badge>
              {stockBajo && (
                <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  <AlertTriangle className="h-3 w-3" /> Stock bajo
                </span>
              )}
            </div>
            <p className="text-sm font-mono text-gray-500 mt-0.5">{producto.codigo}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {(producto.familia as { nombre?: string } | null)?.nombre && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">{(producto.familia as { nombre: string }).nombre}</span>
              )}
              {(producto.fabricante as { nombre?: string } | null)?.nombre && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{(producto.fabricante as { nombre: string }).nombre}</span>
              )}
              {producto.tiene_variantes && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                  <Layers className="h-3 w-3" /> Con variantes
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalAjuste(true)}>
            <Warehouse className="h-4 w-4 mr-1" /> Ajustar stock
          </Button>
          <Button size="sm" onClick={() => setModalEditar(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Precio venta',   value: formatCOP(producto.precio_venta),  color: 'text-green-700', bg: 'bg-green-50'  },
          { label: 'Precio compra',  value: formatCOP(producto.precio_compra), color: 'text-gray-700 dark:text-gray-300',  bg: 'bg-gray-50 dark:bg-gray-950'   },
          { label: 'Margen bruto',   value: `${margen}%`,                      color: margen >= 30 ? 'text-green-700' : margen >= 15 ? 'text-yellow-700' : 'text-red-700', bg: 'bg-white dark:bg-gray-900' },
          { label: 'Stock total',    value: `${stockTotal.toLocaleString('es-CO')} ${producto.unidad_medida ?? 'UND'}`, color: stockBajo ? 'text-orange-700' : 'text-blue-700', bg: stockBajo ? 'bg-orange-50' : 'bg-blue-50' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border border-gray-100 ${k.bg} p-4`}>
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock por bodega */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Warehouse className="h-4 w-4 text-blue-500" /> Stock por bodega
          </h3>
          {(producto.stock ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Sin registro de stock</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(producto.stock ?? []).map(s => {
                const bajo = isLowStock(s)
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-700">{(s.bodega as { nombre?: string } | null)?.nombre ?? 'Bodega'}</span>
                    <div className="flex items-center gap-2">
                      {bajo && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                      <span className={`font-mono text-sm font-medium ${bajo ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        {s.cantidad.toLocaleString('es-CO')}
                      </span>
                      {s.cantidad_minima > 0 && (
                        <span className="text-xs text-gray-400">/ mín {s.cantidad_minima}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Variantes */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" /> Variantes
          </h3>
          {!((producto as any).producto_variantes ?? []).length ? (
            <p className="text-sm text-gray-400">
              {producto.tiene_variantes ? 'Sin variantes registradas' : 'Producto sin variantes'}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {((producto as any).producto_variantes ?? []).map((v: any) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                  <span className="text-gray-700">{[v.talla, v.color].filter(Boolean).join(' / ') || v.sku}</span>
                  {v.precio_venta && <span className="text-gray-500 font-mono">{formatCOP(v.precio_venta)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info adicional */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" /> Información
          </h3>
          <dl className="flex flex-col gap-2 text-sm">
            {producto.codigo_barras && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Cód. barras</dt>
                <dd className="font-mono text-gray-700">{producto.codigo_barras}</dd>
              </div>
            )}
            {producto.unidad_medida && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Unidad</dt>
                <dd className="text-gray-700">{producto.unidad_medida}</dd>
              </div>
            )}
            {(producto.impuesto as { porcentaje?: number } | null)?.porcentaje !== undefined && (
              <div className="flex justify-between">
                <dt className="text-gray-500">IVA</dt>
                <dd className="text-gray-700">{(producto.impuesto as { porcentaje: number }).porcentaje}%</dd>
              </div>
            )}
            {producto.precio_venta2 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">P. mayorista</dt>
                <dd className="text-gray-700">{formatCOP(producto.precio_venta2)}</dd>
              </div>
            )}
            {producto.created_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Creado</dt>
                <dd className="text-gray-700">{formatFecha(producto.created_at)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Movimientos */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" /> Últimos movimientos de inventario
        </h3>
        {movimientos.length === 0 ? (
          <p className="text-sm text-gray-400">Sin movimientos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Fecha</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Bodega</th>
                  <th className="pb-2 text-right text-xs font-medium text-gray-500">Cantidad</th>
                  <th className="pb-2 text-left text-xs font-medium text-gray-500">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movimientos.map(m => {
                  const meta = TIPO_LABELS[m.tipo] ?? { label: m.tipo, icon: RefreshCw, color: 'text-gray-500 dark:text-gray-400 dark:text-gray-500' }
                  const Icon = meta.icon
                  return (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 text-gray-500 font-mono text-xs">{formatFecha(m.created_at)}</td>
                      <td className="py-2">
                        <span className={`flex items-center gap-1 ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">{m.bodega?.nombre ?? '—'}</td>
                      <td className={`py-2 text-right font-mono font-medium ${m.cantidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {m.cantidad >= 0 ? '+' : ''}{m.cantidad.toLocaleString('es-CO')}
                      </td>
                      <td className="py-2 text-gray-400 max-w-[150px] truncate">{m.notas ?? '—'}</td>
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
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormProducto
          inicial={producto}
          familias={familias}
          fabricantes={fabricantes}
          impuestos={impuestos}
          onGuardar={handleGuardar}
          onCancelar={() => setModalEditar(false)}
          cargando={cargando}
        />
      </Modal>

      {/* Modal ajuste */}
      <Modal open={modalAjuste} onClose={() => setModalAjuste(false)} titulo="Ajustar stock" size="sm">
        <AjusteStock
          producto={producto}
          bodegas={bodegas}
          onDone={() => { setModalAjuste(false); router.refresh() }}
          onCancel={() => setModalAjuste(false)}
        />
      </Modal>
    </div>
  )
}
