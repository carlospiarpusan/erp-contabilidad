'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, X, Check, ToggleLeft, ToggleRight } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface CentroCosto {
  id: string
  codigo: string
  nombre: string
  descripcion?: string
  activo: boolean
}

interface Props {
  centrosCosto: CentroCosto[]
}

const emptyForm = { codigo: '', nombre: '', descripcion: '' }

export function GestionCentrosCosto({ centrosCosto: inicial }: Props) {
  const router = useRouter()
  const [centros, setCentros] = useState(inicial)
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function abrirNuevo() {
    setError('')
    setEditandoId(null)
    setForm(emptyForm)
    setCreando(true)
  }

  function cancelar() {
    setCreando(false)
    setEditandoId(null)
    setForm(emptyForm)
    setError('')
  }

  function abrirEditar(c: CentroCosto) {
    setError('')
    setCreando(false)
    setEditandoId(c.id)
    setForm({ codigo: c.codigo, nombre: c.nombre, descripcion: c.descripcion ?? '' })
  }

  async function guardarNuevo() {
    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/contabilidad/centros-costo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo crear el centro de costo')
      setCentros(prev => [...prev, body as CentroCosto])
      setCreando(false)
      setForm(emptyForm)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando centro de costo')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarEdicion() {
    if (!editandoId) return
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/centros-costo/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo actualizar el centro de costo')
      const updated = body as CentroCosto
      setCentros(prev => prev.map(c => c.id === editandoId ? { ...c, ...updated } : c))
      setEditandoId(null)
      setForm(emptyForm)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error actualizando centro de costo')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(c: CentroCosto) {
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/centros-costo/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !c.activo }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo actualizar el estado')
      const updated = body as CentroCosto
      setCentros(prev => prev.map(x => x.id === c.id ? { ...x, ...updated } : x))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error actualizando estado')
    }
  }

  const thCls = 'px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500'
  const tdCls = 'px-4 py-3'
  const inputCls =
    'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={abrirNuevo}
          disabled={creando}
          className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
        >
          <Plus className="h-4 w-4 mr-1" /> Nuevo centro de costo
        </Button>
      </div>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className={thCls}>Código</th>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Descripción</th>
              <th className={`${thCls} text-center`}>Estado</th>
              <th className={`${thCls} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {creando && (
              <tr className="bg-teal-50/50 dark:bg-teal-900/10">
                <td className={tdCls}>
                  <input
                    value={form.codigo}
                    onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                    className={inputCls}
                    placeholder="Ej: CC01"
                    autoFocus
                  />
                </td>
                <td className={tdCls}>
                  <input
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className={inputCls}
                    placeholder="Nombre del centro"
                  />
                </td>
                <td className={tdCls}>
                  <input
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    className={inputCls}
                    placeholder="Descripción (opcional)"
                  />
                </td>
                <td className={`${tdCls} text-center`}>
                  <Badge variant="success">Activo</Badge>
                </td>
                <td className={`${tdCls} text-right`}>
                  <div className="flex gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={guardarNuevo}
                      disabled={guardando || !form.codigo || !form.nombre}
                      className="text-teal-600 hover:text-teal-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelar} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {centros.length === 0 && !creando ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Sin centros de costo
                </td>
              </tr>
            ) : (
              centros.map(c =>
                editandoId === c.id ? (
                  <tr key={c.id} className="bg-teal-50/50 dark:bg-teal-900/10">
                    <td className={tdCls}>
                      <input
                        value={form.codigo}
                        onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                        className={inputCls}
                        autoFocus
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        value={form.nombre}
                        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className={tdCls}>
                      <input
                        value={form.descripcion}
                        onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                        className={inputCls}
                      />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <Badge variant={c.activo ? 'success' : 'default'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={guardarEdicion}
                          disabled={guardando || !form.codigo || !form.nombre}
                          className="text-teal-600 hover:text-teal-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelar} className="text-gray-400 hover:text-gray-600">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                    <td className={`${tdCls} font-mono text-xs text-gray-700 dark:text-gray-300`}>{c.codigo}</td>
                    <td className={`${tdCls} font-medium text-gray-900 dark:text-gray-100`}>{c.nombre}</td>
                    <td className={`${tdCls} text-gray-500 dark:text-gray-400`}>{c.descripcion || '—'}</td>
                    <td className={`${tdCls} text-center`}>
                      <Badge variant={c.activo ? 'success' : 'default'}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className={`${tdCls} text-right`}>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => toggleActivo(c)} title={c.activo ? 'Desactivar' : 'Activar'}>
                          {c.activo ? (
                            <ToggleRight className="h-5 w-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-300" />
                          )}
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
