'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Paginacion } from '@/components/ui/paginacion'
import { FormProducto } from './FormProducto'
import type { Producto, Familia, Fabricante, Impuesto, Bodega } from '@/types'
import { formatCOP } from '@/utils/cn'
import { hasLowStock } from '@/lib/utils/stock'
import { Search, Plus, Pencil, Layers, AlertTriangle, Eye, SlidersHorizontal, Trash2 } from 'lucide-react'
import Link from 'next/link'

const COLUMNAS = [
  { key: 'codigo',      label: 'Código' },
  { key: 'descripcion', label: 'Producto' },
  { key: 'familia',     label: 'Categoría' },
  { key: 'pventa',      label: 'P. Venta',   className: 'text-right' },
  { key: 'pcompra',     label: 'P. Compra',  className: 'text-right' },
  { key: 'margen',      label: 'Margen',     className: 'text-right' },
  { key: 'stock',       label: 'Stock',      className: 'text-center' },
  { key: 'acciones',    label: '',           className: 'w-24' },
]

interface ListaProductosProps {
  productos:       Producto[]
  total:           number
  familias:        Familia[]
  fabricantes:     Fabricante[]
  impuestos:       Impuesto[]
  bodegas:         Bodega[]
  busqueda:        string
  familiaFiltro?:  string
  fabricanteFiltro?: string
  soloInactivos?:  boolean
  offset:          number
  limit:           number
  canManage:       boolean
  canSetInitialStock: boolean
}

export function ListaProductos({
  productos, total, familias, fabricantes, impuestos, bodegas,
  busqueda: busqInicial, familiaFiltro: familiaInicial = '',
  fabricanteFiltro: fabricanteInicial = '', soloInactivos: soloInactivosInicial = false,
  offset: offsetInicial, limit, canManage, canSetInitialStock,
}: ListaProductosProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda]          = useState(busqInicial)
  const [familia_id, setFamiliaId]       = useState(familiaInicial)
  const [fabricante_id, setFabricanteId] = useState(fabricanteInicial)
  const [soloInactivos, setSoloInactivos] = useState(soloInactivosInicial)
  const [offset, setOffset]              = useState(offsetInicial)
  const [showFiltros, setFiltros]        = useState(false)
  const [modal, setModal]                = useState(false)
  const [editar, setEditar]              = useState<Producto | null>(null)
  const [cargando, setCargando]          = useState(false)
  const [eliminandoId, setEliminandoId]  = useState<string | null>(null)
  const [error, setError]                = useState('')

  function navegar(params: Record<string, string | number | boolean>) {
    const sp = new URLSearchParams()
    if (params.q)             sp.set('q', String(params.q))
    if (params.offset)        sp.set('offset', String(params.offset))
    if (params.familia_id)    sp.set('familia_id', String(params.familia_id))
    if (params.fabricante_id) sp.set('fabricante_id', String(params.fabricante_id))
    if (params.inactivos)     sp.set('inactivos', '1')
    startTransition(() => router.push(`/productos?${sp.toString()}`))
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    navegar({ q: busqueda, familia_id, fabricante_id, inactivos: soloInactivos })
  }

  function handleFiltros() {
    setOffset(0)
    navegar({ q: busqueda, familia_id, fabricante_id, inactivos: soloInactivos })
  }

  async function handleGuardar(datos: Record<string, unknown>) {
    setCargando(true); setError('')
    try {
      const url    = editar ? `/api/productos/${editar.id}` : '/api/productos'
      const method = editar ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'Error') }
      setModal(false); setEditar(null); router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  async function handleEliminar(producto: Producto) {
    const confirmado = window.confirm(
      `Vas a eliminar "${producto.descripcion}". Si tiene movimientos, stock o documentos relacionados se desactivará en lugar de borrarse.`
    )
    if (!confirmado) return

    setError('')
    setEliminandoId(producto.id)
    try {
      const res = await fetch(`/api/productos/${producto.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Error al eliminar producto')
      if (body?.message) window.alert(body.message)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setEliminandoId(null)
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
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código, nombre, barras..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-400"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        <button
          onClick={() => setFiltros(p => !p)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${showFiltros ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/70'}`}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filtros
          {(familia_id || fabricante_id) && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">!</span>}
        </button>

        {canManage && (
          <Button variant="success" size="sm" onClick={() => { setEditar(null); setModal(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Panel filtros */}
      {showFiltros && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Familia / Categoría</label>
            <select
              value={familia_id}
              onChange={e => setFamiliaId(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
            >
              <option value="">Todas</option>
              {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Fabricante / Marca</label>
            <select
              value={fabricante_id}
              onChange={e => setFabricanteId(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
            >
              <option value="">Todos</option>
              {fabricantes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 justify-center">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Estado</label>
            <label className="flex h-8 cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={soloInactivos}
                onChange={e => setSoloInactivos(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-gray-600"
              />
              Solo inactivos
            </label>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={handleFiltros}>Aplicar</Button>
            <Button size="sm" variant="outline" onClick={() => {
              setFamiliaId(''); setFabricanteId(''); setSoloInactivos(false); navegar({ q: busqueda })
            }}>Limpiar</Button>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">
        {total.toLocaleString('es-CO')} producto{total !== 1 ? 's' : ''}
      </p>

      <Tabla columnas={COLUMNAS}>
        {productos.length === 0 ? (
          <tr>
            <td colSpan={8} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
              No se encontraron productos
            </td>
          </tr>
        ) : productos.map(p => {
          const stockTotal = calcularStock(p)
          const margen     = calcularMargen(p)
          const stockBajo  = hasLowStock(p.stock)
          return (
            <FilaTabla key={p.id}>
              <CeldaTabla>
                <span className="font-mono text-xs font-medium text-gray-600 dark:text-gray-300">{p.codigo}</span>
              </CeldaTabla>
              <CeldaTabla>
                <Link href={`/productos/${p.id}`} className="group">
                  <p className="font-medium text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-300">{p.descripcion}</p>
                  <div className="flex gap-1 mt-0.5">
                    {!p.activo && (
                      <Badge variant="danger">Inactivo</Badge>
                    )}
                    {(p.fabricante as { nombre?: string } | null)?.nombre && (
                      <span className="text-xs text-gray-400">{(p.fabricante as { nombre: string }).nombre}</span>
                    )}
                    {p.tiene_variantes && (
                      <Badge variant="info"><Layers className="h-2.5 w-2.5 mr-1" />Variantes</Badge>
                    )}
                  </div>
                </Link>
              </CeldaTabla>
              <CeldaTabla>
                {(p.familia as { nombre?: string } | null)?.nombre && (
                  <Badge variant="outline">{(p.familia as { nombre: string }).nombre}</Badge>
                )}
              </CeldaTabla>
              <CeldaTabla className="text-right font-medium text-gray-900">
                {formatCOP(p.precio_venta)}
              </CeldaTabla>
              <CeldaTabla className="text-right text-gray-500 dark:text-gray-400">
                {formatCOP(p.precio_compra)}
              </CeldaTabla>
              <CeldaTabla className="text-right">
                <span className={margen >= 30 ? 'font-medium text-green-600 dark:text-green-300' : margen >= 15 ? 'text-yellow-600 dark:text-yellow-300' : 'text-red-600 dark:text-red-300'}>
                  {margen}%
                </span>
              </CeldaTabla>
              <CeldaTabla className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {stockBajo && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                  <span className={stockBajo ? 'font-medium text-orange-600 dark:text-orange-300' : 'dark:text-gray-200'}>
                    {stockTotal.toLocaleString('es-CO')}
                  </span>
                </div>
              </CeldaTabla>
              <CeldaTabla>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/productos/${p.id}`}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                    title="Ver detalle"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  {canManage && (
                    <>
                      <button
                        onClick={() => { setEditar(p); setModal(true) }}
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleEliminar(p)}
                        disabled={eliminandoId === p.id}
                        className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                        title="Eliminar o desactivar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </CeldaTabla>
            </FilaTabla>
          )
        })}
      </Tabla>

      <Paginacion
        total={total} limit={limit} offset={offset}
        onChange={o => { setOffset(o); navegar({ q: busqueda, familia_id, fabricante_id, inactivos: soloInactivos, offset: o }) }}
      />

      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditar(null) }}
        titulo={editar ? 'Editar producto' : 'Nuevo producto'}
        size="xl"
      >
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
        <FormProducto
          inicial={editar ?? undefined}
          familias={familias}
          fabricantes={fabricantes}
          impuestos={impuestos}
          bodegas={bodegas}
          canSetInitialStock={canSetInitialStock}
          onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditar(null) }}
          cargando={cargando}
        />
      </Modal>
    </div>
  )
}
