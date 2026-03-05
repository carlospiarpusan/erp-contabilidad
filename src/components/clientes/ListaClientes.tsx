'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Paginacion } from '@/components/ui/paginacion'
import { FormCliente } from './FormCliente'
import type { Cliente, GrupoCliente } from '@/types'
import { Search, Plus, Pencil, Trash2, Phone, Mail, Eye, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'

const COLUMNAS = [
  { key: 'razon_social', label: 'Cliente' },
  { key: 'documento', label: 'Documento' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'grupo', label: 'Grupo' },
  { key: 'estado', label: 'Estado', className: 'text-center' },
  { key: 'acciones', label: '', className: 'w-28' },
]

const TIPOS_DOC = [
  { value: '', label: 'Todos los tipos' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CC', label: 'Cédula' },
  { value: 'CE', label: 'C. Extranjería' },
  { value: 'PAS', label: 'Pasaporte' },
]

interface ListaClientesProps {
  clientes: Cliente[]
  total: number
  grupos: GrupoCliente[]
  busqueda: string
  offset: number
  limit: number
  grupoFiltro: string
  tipoFiltro: string
}

export function ListaClientes({
  clientes, total, grupos,
  busqueda: busquedaInicial, offset: offsetInicial, limit,
  grupoFiltro: grupoInicial, tipoFiltro: tipoInicial
}: ListaClientesProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [busqueda, setBusqueda] = useState(busquedaInicial)
  const [grupo_id, setGrupoId] = useState(grupoInicial)
  const [tipo, setTipo] = useState(tipoInicial)
  const [offset, setOffset] = useState(offsetInicial)
  const [showFiltros, setFiltros] = useState(false)
  const [modalAbierto, setModal] = useState(false)
  const [clienteEditar, setEditar] = useState<Cliente | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  function navegar(params: Record<string, string | number>) {
    const sp = new URLSearchParams()
    if (params.q) sp.set('q', String(params.q))
    if (params.offset) sp.set('offset', String(params.offset))
    if (params.grupo_id) sp.set('grupo_id', String(params.grupo_id))
    if (params.tipo_documento) sp.set('tipo_documento', String(params.tipo_documento))
    startTransition(() => router.push(`/clientes?${sp.toString()}`))
  }

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setOffset(0)
    navegar({ q: busqueda, grupo_id, tipo_documento: tipo })
  }

  function handleFiltros() {
    setOffset(0)
    navegar({ q: busqueda, grupo_id, tipo_documento: tipo })
  }

  async function handleGuardar(datos: Record<string, unknown>) {
    setCargando(true); setError('')
    try {
      const url = clienteEditar ? `/api/clientes/${clienteEditar.id}` : '/api/clientes'
      const method = clienteEditar ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'Error') }
      setModal(false); setEditar(null); router.refresh()
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de eliminar al cliente "${nombre}"?\nSi tiene facturas asociadas, solo se desactivará.`)) return

    setCargando(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al eliminar')
      }

      router.refresh()
    } catch (e: any) {
      alert(e.message || 'Error al eliminar cliente')
    } finally {
      setCargando(false)
    }
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
              placeholder="Buscar por nombre, NIT, email..."
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
          {(grupo_id || tipo) && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">!</span>}
        </button>

        <Button variant="success" size="sm" onClick={() => { setEditar(null); setModal(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      {/* Panel filtros */}
      {showFiltros && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Grupo</label>
            <select
              value={grupo_id}
              onChange={e => setGrupoId(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Tipo documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" onClick={handleFiltros}>Aplicar</Button>
            <Button size="sm" variant="outline" onClick={() => {
              setGrupoId(''); setTipo(''); navegar({ q: busqueda })
            }}>Limpiar</Button>
          </div>
        </div>
      )}

      {/* Contador */}
      <p className="text-sm text-gray-500">
        {total.toLocaleString('es-CO')} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
      </p>

      {/* Tabla */}
      <Tabla columnas={COLUMNAS}>
        {clientes.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
              No se encontraron clientes
            </td>
          </tr>
        ) : clientes.map(c => (
          <FilaTabla key={c.id}>
            <CeldaTabla>
              <Link href={`/clientes/${c.id}`} className="group">
                <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">{c.razon_social}</p>
                {c.nombre_contacto && <p className="text-xs text-gray-400">{c.nombre_contacto}</p>}
              </Link>
            </CeldaTabla>
            <CeldaTabla>
              <span className="font-mono text-xs text-gray-600">
                {c.tipo_documento} {c.numero_documento}{c.dv ? `-${c.dv}` : ''}
              </span>
            </CeldaTabla>
            <CeldaTabla>
              <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                {c.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.telefono}</span>}
                {c.email && <span className="flex items-center gap-1 truncate max-w-[150px]"><Mail className="h-3 w-3" />{c.email}</span>}
              </div>
            </CeldaTabla>
            <CeldaTabla>
              {(c.grupo as { nombre?: string } | null)?.nombre ? (
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: (c.grupo as { color?: string } | null)?.color ?? '#E5E7EB', color: '#374151' }}
                >
                  {(c.grupo as { nombre: string }).nombre}
                </span>
              ) : (
                <span className="text-xs text-gray-300">—</span>
              )}
            </CeldaTabla>
            <CeldaTabla className="text-center">
              <Badge variant={c.activo ? 'success' : 'danger'}>
                {c.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </CeldaTabla>
            <CeldaTabla>
              <div className="flex items-center gap-1">
                <Link
                  href={`/clientes/${c.id}`}
                  className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title="Ver detalle"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={() => { setEditar(c); setModal(true) }}
                  className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleEliminar(c.id, c.razon_social)}
                  disabled={cargando}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Eliminar o Desactivar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CeldaTabla>
          </FilaTabla>
        ))}
      </Tabla>

      <Paginacion
        total={total} limit={limit} offset={offset}
        onChange={newOffset => { setOffset(newOffset); navegar({ q: busqueda, grupo_id, tipo_documento: tipo, offset: newOffset }) }}
      />

      <Modal
        open={modalAbierto}
        onClose={() => { setModal(false); setEditar(null) }}
        titulo={clienteEditar ? 'Editar cliente' : 'Nuevo cliente'}
        size="lg"
      >
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <FormCliente
          inicial={clienteEditar ?? undefined}
          grupos={grupos}
          onGuardar={handleGuardar}
          onCancelar={() => { setModal(false); setEditar(null) }}
          cargando={cargando}
        />
      </Modal>
    </div>
  )
}
