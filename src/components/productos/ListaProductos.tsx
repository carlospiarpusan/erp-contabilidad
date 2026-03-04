'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Paginacion } from '@/components/ui/paginacion'
import { FormProducto } from './FormProducto'
import type { Producto, Familia, Fabricante, Impuesto } from '@/types'
import { formatCOP } from '@/utils/cn'
import { Search, Plus, Pencil, Layers, AlertTriangle } from 'lucide-react'

const COLUMNAS = [
  { key: 'codigo',      label: 'Código' },
  { key: 'descripcion', label: 'Producto' },
  { key: 'familia',     label: 'Categoría' },
  { key: 'pventa',      label: 'P. Venta',   className: 'text-right' },
  { key: 'pcompra',     label: 'P. Compra',  className: 'text-right' },
  { key: 'margen',      label: 'Margen',     className: 'text-right' },
  { key: 'stock',       label: 'Stock',      className: 'text-center' },
  { key: 'acciones',    label: '',           className: 'w-20' },
]

interface ListaProductosProps {
  productos:   Producto[]
  total:       number
  familias:    Familia[]
  fabricantes: Fabricante[]
  impuestos:   Impuesto[]
  busqueda:    string
  offset:      number
  limit:       number
}

export function ListaProductos({ productos, total, familias, fabricantes, impuestos, busqueda: busqInicial, offset: offsetInicial, limit }: ListaProductosProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda]    = useState(busqInicial)
  const [offset, setOffset]        = useState(offsetInicial)
  const [modal, setModal]          = useState(false)
  const [editar, setEditar]        = useState<Producto | null>(null)
  const [cargando, setCargando]    = useState(false)
  const [error, setError]          = useState('')

  function navegar(params: Record<string, string | number>) {
    const sp = new URLSearchParams()
    if (params.q)      sp.set('q', String(params.q))
    if (params.offset) sp.set('offset', String(params.offset))
    startTransition(() => router.push(`/productos?${sp.toString()}`))
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    navegar({ q: busqueda })
  }

  async function handleGuardar(datos: any) {
    setCargando(true)
    setError('')
    try {
      const { variantes, ...productoData } = datos
      const url    = editar ? `/api/productos/${editar.id}` : '/api/productos'
      const method = editar ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...productoData, variantes }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Error al guardar')
      }
      setModal(false)
      setEditar(null)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  function calcularStock(p: Producto) {
    return (p.stock ?? []).reduce((s, st) => s + (st.cantidad ?? 0), 0)
  }

  function calcularMargen(p: Producto) {
    if (!p.precio_venta || p.precio_venta === 0) return 0
    return Math.round(((p.precio_venta - p.precio_compra) / p.precio_venta) * 100)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleBuscar} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre, barras..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        <Button
          variant="success"
          size="sm"
          onClick={() => { setEditar(null); setModal(true) }}
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        {total.toLocaleString('es-CO')} producto{total !== 1 ? 's' : ''}
      </p>

      <Tabla columnas={COLUMNAS}>
        {productos.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
              No se encontraron productos
            </td>
          </tr>
        ) : (
          productos.map((p) => {
            const stockTotal = calcularStock(p)
            const margen     = calcularMargen(p)
            const stockBajo  = p.stock?.some(s => s.cantidad <= s.cantidad_minima && s.cantidad_minima > 0)

            return (
              <FilaTabla key={p.id}>
                <CeldaTabla>
                  <span className="font-mono text-xs font-medium text-gray-600">{p.codigo}</span>
                </CeldaTabla>
                <CeldaTabla>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{p.descripcion}</p>
                      <div className="flex gap-1 mt-0.5">
                        {p.fabricante && (
                          <span className="text-xs text-gray-400">{(p.fabricante as any).nombre}</span>
                        )}
                        {p.tiene_variantes && (
                          <Badge variant="info">
                            <Layers className="h-2.5 w-2.5 mr-1" />
                            Variantes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CeldaTabla>
                <CeldaTabla>
                  {p.familia && (
                    <Badge variant="outline">{(p.familia as any).nombre}</Badge>
                  )}
                </CeldaTabla>
                <CeldaTabla className="text-right font-medium text-gray-900">
                  {formatCOP(p.precio_venta)}
                </CeldaTabla>
                <CeldaTabla className="text-right text-gray-500">
                  {formatCOP(p.precio_compra)}
                </CeldaTabla>
                <CeldaTabla className="text-right">
                  <span className={margen >= 30 ? 'text-green-600 font-medium' : margen >= 15 ? 'text-yellow-600' : 'text-red-600'}>
                    {margen}%
                  </span>
                </CeldaTabla>
                <CeldaTabla className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {stockBajo && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                    <span className={stockBajo ? 'text-orange-600 font-medium' : ''}>
                      {stockTotal.toLocaleString('es-CO')}
                    </span>
                  </div>
                </CeldaTabla>
                <CeldaTabla>
                  <button
                    onClick={() => { setEditar(p); setModal(true) }}
                    className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </CeldaTabla>
              </FilaTabla>
            )
          })
        )}
      </Tabla>

      <Paginacion
        total={total}
        limit={limit}
        offset={offset}
        onChange={(o) => { setOffset(o); navegar({ q: busqueda, offset: o }) }}
      />

      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditar(null) }}
        titulo={editar ? 'Editar producto' : 'Nuevo producto'}
        size="xl"
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <FormProducto
          inicial={editar ?? undefined}
          familias={familias}
          fabricantes={fabricantes}
          impuestos={impuestos}
          onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditar(null) }}
          cargando={cargando}
        />
      </Modal>
    </div>
  )
}
