'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Truck, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

interface Proveedor {
  id: string
  razon_social: string
  contacto?: string | null
  tipo_documento?: string | null
  numero_documento?: string | null
  dv?: string | null
  email?: string | null
  telefono?: string | null
  whatsapp?: string | null
  ciudad?: string | null
  departamento?: string | null
  direccion?: string | null
  observaciones?: string | null
  activo: boolean
}

interface Props {
  proveedores: Proveedor[]
  total: number
}

const EMPTY: Partial<Proveedor> = {
  razon_social: '', contacto: '', tipo_documento: 'NIT',
  numero_documento: '', email: '', telefono: '', ciudad: '',
}

function extractError(res: unknown): string {
  if (!res || typeof res !== 'object') return ''
  const obj = res as Record<string, unknown>
  if (typeof obj.error === 'string') return obj.error
  return ''
}

async function apiCall(url: string, opts?: RequestInit): Promise<{ ok: boolean; data: unknown; error: string }> {
  try {
    const res = await fetch(url, opts)
    const text = await res.text()
    let data: unknown = null
    try { data = JSON.parse(text) } catch { data = { error: text || 'Sin respuesta' } }
    if (!res.ok) {
      return { ok: false, data, error: extractError(data) || `Error ${res.status}` }
    }
    return { ok: true, data, error: '' }
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : 'Error de conexión' }
  }
}

export function ListaProveedores({ proveedores: inicial, total }: Props) {
  const router = useRouter()
  const [proveedores, setProveedores] = useState(inicial)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<Partial<Proveedor>>(EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [errorTabla, setErrorTabla] = useState('')
  const [confirmBorrar, setConfirmBorrar] = useState<Proveedor | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')

  const filtrados = proveedores.filter(p =>
    p && typeof p === 'object' && (
      (p.razon_social ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.numero_documento ?? '').includes(busqueda)
    )
  )

  function abrirNuevo() {
    setEditando(null)
    setForm(EMPTY)
    setErrorGuardar('')
    setModal(true)
  }

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setForm({ ...p })
    setErrorGuardar('')
    setModal(true)
  }

  async function guardar() {
    if (!form.razon_social?.trim()) return
    setGuardando(true)
    setErrorGuardar('')
    try {
      if (editando) {
        const { ok, data, error } = await apiCall(`/api/compras/proveedores/${editando.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!ok) { setErrorGuardar(error); return }
        const updated = data as Proveedor
        if (updated?.id) {
          setProveedores(prev => prev.map(p => p.id === editando.id ? updated : p))
        }
      } else {
        const { ok, data, error } = await apiCall('/api/compras/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!ok) { setErrorGuardar(error); return }
        const created = data as Proveedor
        if (created?.id) {
          setProveedores(prev => [created, ...prev])
        }
      }
      setModal(false)
      router.refresh()
    } catch (e) {
      setErrorGuardar(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!confirmBorrar) return
    setBorrando(true)
    setErrorBorrar('')
    try {
      const { ok, error } = await apiCall(`/api/compras/proveedores/${confirmBorrar.id}`, {
        method: 'DELETE',
      })
      if (!ok) { setErrorBorrar(error); return }
      setProveedores(prev => prev.filter(p => p.id !== confirmBorrar.id))
      setConfirmBorrar(null)
      router.refresh()
    } catch (e) {
      setErrorBorrar(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setBorrando(false)
    }
  }

  async function toggleActivo(p: Proveedor) {
    setErrorTabla('')
    const { ok, data, error } = await apiCall(`/api/compras/proveedores/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !p.activo }),
    })
    if (!ok) { setErrorTabla(error); return }
    const updated = data as Proveedor
    if (updated?.id) {
      setProveedores(prev => prev.map(x => x.id === p.id ? updated : x))
    }
  }

  const field = (k: keyof Proveedor, label: string, type = 'text', opts?: string[]) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {opts ? (
        <select
          value={(form[k] as string) ?? ''}
          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={(form[k] as string) ?? ''}
          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar proveedor o NIT…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Button size="sm" onClick={abrirNuevo}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo proveedor
        </Button>
      </div>

      {/* Error de tabla / toggle */}
      {errorTabla && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorTabla}
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Proveedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">NIT / Documento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Contacto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Ciudad</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No hay proveedores{busqueda ? ` para "${busqueda}"` : ''}
                </td>
              </tr>
            ) : filtrados.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50 cursor-pointer" onClick={() => router.push(`/compras/proveedores/${p.id}`)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                      <Truck className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="font-medium text-gray-900">{p.razon_social || 'Proveedor sin nombre'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {p.tipo_documento} {p.numero_documento ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{p.contacto ?? '—'}</div>
                  {p.email && <div className="text-xs text-gray-400">{p.email}</div>}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.ciudad ?? '—'}</td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => toggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'}>
                    {p.activo
                      ? <ToggleRight className="h-5 w-5 text-green-500 mx-auto" />
                      : <ToggleLeft className="h-5 w-5 text-gray-300 mx-auto" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setErrorBorrar(''); setConfirmBorrar(p) }}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {total} proveedor{total !== 1 ? 'es' : ''} en total
        </div>
      </div>

      {/* Modal confirmar borrar */}
      <Modal
        open={!!confirmBorrar}
        onClose={() => { setConfirmBorrar(null); setErrorBorrar('') }}
        titulo="Eliminar proveedor"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-700">
            ¿Seguro que deseas eliminar <strong>{confirmBorrar?.razon_social ?? 'este proveedor'}</strong>? Esta acción no se puede deshacer.
          </p>
          {errorBorrar && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorBorrar}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setConfirmBorrar(null); setErrorBorrar('') }} disabled={borrando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={borrar} disabled={borrando}
              className="bg-red-600 hover:bg-red-700 text-white">
              {borrando ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal crear/editar */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setErrorGuardar('') }}
        titulo={editando ? 'Editar proveedor' : 'Nuevo proveedor'}
        size="md"
      >
        <div className="flex flex-col gap-4">
          {errorGuardar && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorGuardar}</div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('razon_social', 'Razón social *')}</div>
            {field('tipo_documento', 'Tipo documento', 'text', ['NIT', 'CC', 'CE', 'PAS'])}
            {field('numero_documento', 'Número documento')}
            {field('dv', 'DV')}
            {field('contacto', 'Contacto')}
            {field('email', 'Email', 'email')}
            {field('telefono', 'Teléfono')}
            {field('whatsapp', 'WhatsApp')}
            {field('ciudad', 'Ciudad')}
            {field('departamento', 'Departamento')}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Dirección</label>
              <input
                value={(form.direccion as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
              <textarea
                rows={2}
                value={(form.observaciones as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setModal(false); setErrorGuardar('') }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.razon_social?.trim()}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
