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
import { Search, Plus, Pencil, Trash2, Phone, Mail } from 'lucide-react'

const COLUMNAS = [
  { key: 'razon_social', label: 'Cliente' },
  { key: 'documento',    label: 'Documento' },
  { key: 'contacto',     label: 'Contacto' },
  { key: 'ciudad',       label: 'Ciudad' },
  { key: 'estado',       label: 'Estado', className: 'text-center' },
  { key: 'acciones',     label: '', className: 'w-24' },
]

interface ListaClientesProps {
  clientes:  Cliente[]
  total:     number
  grupos:    GrupoCliente[]
  busqueda:  string
  offset:    number
  limit:     number
}

export function ListaClientes({ clientes, total, grupos, busqueda: busquedaInicial, offset: offsetInicial, limit }: ListaClientesProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busqueda, setBusqueda]       = useState(busquedaInicial)
  const [offset, setOffset]           = useState(offsetInicial)
  const [modalAbierto, setModal]      = useState(false)
  const [clienteEditar, setEditar]    = useState<Cliente | null>(null)
  const [cargando, setCargando]       = useState(false)
  const [error, setError]             = useState('')

  function navegar(params: Record<string, string | number>) {
    const sp = new URLSearchParams()
    if (params.q)      sp.set('q', String(params.q))
    if (params.offset) sp.set('offset', String(params.offset))
    startTransition(() => router.push(`/clientes?${sp.toString()}`))
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
      const url    = clienteEditar ? `/api/clientes/${clienteEditar.id}` : '/api/clientes'
      const method = clienteEditar ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
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

  async function handleEliminar(id: string, nombre: string) {
    if (!confirm(`¿Desactivar al cliente "${nombre}"?`)) return
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    router.refresh()
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
              placeholder="Buscar por nombre, NIT, email..."
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
          Nuevo cliente
        </Button>
      </div>

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
        ) : (
          clientes.map((c) => (
            <FilaTabla key={c.id}>
              <CeldaTabla>
                <div>
                  <p className="font-medium text-gray-900">{c.razon_social}</p>
                  {c.nombre_contacto && (
                    <p className="text-xs text-gray-400">{c.nombre_contacto}</p>
                  )}
                </div>
              </CeldaTabla>
              <CeldaTabla>
                <span className="font-mono text-xs">
                  {c.tipo_documento} {c.numero_documento}{c.dv ? `-${c.dv}` : ''}
                </span>
              </CeldaTabla>
              <CeldaTabla>
                <div className="flex flex-col gap-0.5 text-xs text-gray-500">
                  {c.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {c.telefono}
                    </span>
                  )}
                  {c.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {c.email}
                    </span>
                  )}
                </div>
              </CeldaTabla>
              <CeldaTabla>
                <span className="text-xs">{c.ciudad}</span>
              </CeldaTabla>
              <CeldaTabla className="text-center">
                <Badge variant={c.activo ? 'success' : 'danger'}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </CeldaTabla>
              <CeldaTabla>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditar(c); setModal(true) }}
                    className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleEliminar(c.id, c.razon_social)}
                    className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Desactivar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CeldaTabla>
            </FilaTabla>
          ))
        )}
      </Tabla>

      {/* Paginación */}
      <Paginacion
        total={total}
        limit={limit}
        offset={offset}
        onChange={(newOffset) => {
          setOffset(newOffset)
          navegar({ q: busqueda, offset: newOffset })
        }}
      />

      {/* Modal crear / editar */}
      <Modal
        open={modalAbierto}
        onClose={() => { setModal(false); setEditar(null) }}
        titulo={clienteEditar ? 'Editar cliente' : 'Nuevo cliente'}
        size="lg"
      >
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
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
