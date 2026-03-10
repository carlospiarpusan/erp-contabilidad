'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Paginacion } from '@/components/ui/paginacion'
import { formatCOP, formatFecha } from '@/utils/cn'
import { Search, Plus, Eye, SlidersHorizontal, Download } from 'lucide-react'
import Link from 'next/link'

const COLUMNAS = [
  { key: 'numero',   label: 'N°' },
  { key: 'fecha',    label: 'Fecha' },
  { key: 'cliente',  label: 'Cliente' },
  { key: 'total',    label: 'Total',      className: 'text-right' },
  { key: 'estado',   label: 'Estado',     className: 'text-center' },
  { key: 'acciones', label: '',           className: 'w-16' },
]

const ESTADOS = [
  { value: '',          label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'pagada',    label: 'Pagada' },
  { value: 'cancelada', label: 'Cancelada' },
]

const BADGE_ESTADO: Record<string, 'success' | 'danger' | 'warning' | 'outline'> = {
  pendiente: 'warning',
  pagada:    'success',
  cancelada: 'danger',
  vencida:   'danger',
}

interface Factura {
  id:             string
  numero:         number
  prefijo:        string
  fecha:          string
  fecha_vencimiento?: string
  total:          number
  estado:         string
  cliente?: { id: string; razon_social: string } | null
  forma_pago?: { descripcion: string } | null
}

interface Props {
  facturas:      Factura[]
  total:         number
  busqueda:      string
  estadoFiltro:  string
  offset:        number
  limit:         number
  cliente_id?:   string
  clienteNombre?: string
}

export function ListaFacturas({ facturas, total, busqueda: busqInicial, estadoFiltro: estadoInicial, offset: offsetInicial, limit, cliente_id, clienteNombre }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda]    = useState(busqInicial)
  const [estado, setEstado]        = useState(estadoInicial)
  const [offset, setOffset]        = useState(offsetInicial)
  const [showFiltros, setFiltros]  = useState(false)

  function navegar(params: Record<string, string | number>) {
    const sp = new URLSearchParams()
    if (params.q)      sp.set('q', String(params.q))
    if (params.estado) sp.set('estado', String(params.estado))
    if (params.offset) sp.set('offset', String(params.offset))
    if (cliente_id)    sp.set('cliente_id', cliente_id)
    startTransition(() => router.push(`/ventas/facturas?${sp.toString()}`))
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault(); setOffset(0)
    navegar({ q: busqueda, estado })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Banner filtro cliente */}
      {cliente_id && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span>Mostrando facturas de: <strong>{clienteNombre ?? 'cliente seleccionado'}</strong></span>
          <Link href="/ventas/facturas" className="text-xs text-blue-500 hover:underline">Ver todas</Link>
        </div>
      )}
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleBuscar} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Número, prefijo, cliente u observación..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">Buscar</Button>
        </form>

        <button
          onClick={() => setFiltros(p => !p)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${showFiltros ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950'}`}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filtros
          {estado && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">!</span>}
        </button>

        <a href="/api/export/ventas" download>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />CSV</Button>
        </a>

        <Link href="/ventas/facturas/nueva">
          <Button variant="success" size="sm"><Plus className="h-4 w-4 mr-1" />Nueva factura</Button>
        </Link>
      </div>

      {/* Filtros */}
      {showFiltros && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Estado</label>
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={() => { setOffset(0); navegar({ q: busqueda, estado }) }}>Aplicar</Button>
            <Button size="sm" variant="outline" onClick={() => { setEstado(''); navegar({ q: busqueda }) }}>Limpiar</Button>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">{total.toLocaleString('es-CO')} factura{total !== 1 ? 's' : ''}</p>

      <Tabla columnas={COLUMNAS}>
        {facturas.length === 0 ? (
          <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No se encontraron facturas</td></tr>
        ) : facturas.map(f => (
          <FilaTabla key={f.id}>
            <CeldaTabla>
              <Link href={`/ventas/facturas/${f.id}`} className="font-mono text-sm font-medium text-blue-600 hover:underline">
                {f.prefijo}{f.numero}
              </Link>
            </CeldaTabla>
            <CeldaTabla>
              <p className="text-sm text-gray-700">{formatFecha(f.fecha)}</p>
              {f.fecha_vencimiento && (
                <p className="text-xs text-gray-400">Vence: {formatFecha(f.fecha_vencimiento)}</p>
              )}
            </CeldaTabla>
            <CeldaTabla>
              <p className="font-medium text-gray-900">{(f.cliente as { razon_social?: string } | null)?.razon_social ?? '—'}</p>
              {(f.forma_pago as { descripcion?: string } | null)?.descripcion && (
                <p className="text-xs text-gray-400">{(f.forma_pago as { descripcion: string }).descripcion}</p>
              )}
            </CeldaTabla>
            <CeldaTabla className="text-right font-mono font-medium text-gray-900">
              {formatCOP(f.total)}
            </CeldaTabla>
            <CeldaTabla className="text-center">
              <Badge variant={BADGE_ESTADO[f.estado] ?? 'outline'}>
                {(f.estado ?? '').charAt(0).toUpperCase() + (f.estado ?? '').slice(1)}
              </Badge>
            </CeldaTabla>
            <CeldaTabla>
              <Link href={`/ventas/facturas/${f.id}`} className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors inline-flex" title="Ver detalle">
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </CeldaTabla>
          </FilaTabla>
        ))}
      </Tabla>

      <Paginacion
        total={total} limit={limit} offset={offset}
        onChange={o => { setOffset(o); navegar({ q: busqueda, estado, offset: o }) }}
      />
    </div>
  )
}
