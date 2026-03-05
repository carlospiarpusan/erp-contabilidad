'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GrupoCliente } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, Tag, Percent } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

type GrupoConConteo = GrupoCliente & { clientes: { count: number }[] }

interface Props {
  grupos: GrupoConConteo[]
}

const COLORES = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarillo' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#8B5CF6', label: 'Morado' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#6B7280', label: 'Gris' },
]

interface FormGrupo {
  nombre: string
  descuento_porcentaje: string
  limite_credito: string
  color: string
  descripcion: string
}

const FORM_VACIO: FormGrupo = {
  nombre: '',
  descuento_porcentaje: '0',
  limite_credito: '0',
  color: '#3B82F6',
  descripcion: '',
}

export function GruposClientes({ grupos: init }: Props) {
  const router = useRouter()
  const [grupos, setGrupos] = useState(init)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<GrupoConConteo | null>(null)
  const [form, setForm] = useState<FormGrupo>(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setError('')
    setModal(true)
  }

  function abrirEditar(g: GrupoConConteo) {
    setEditando(g)
    setForm({
      nombre: g.nombre,
      descuento_porcentaje: String(g.descuento_porcentaje ?? 0),
      limite_credito: String(g.limite_credito ?? 0),
      color: g.color ?? '#3B82F6',
      descripcion: g.descripcion ?? '',
    })
    setError('')
    setModal(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      nombre: form.nombre,
      descuento_porcentaje: parseFloat(form.descuento_porcentaje) || 0,
      limite_credito: parseFloat(form.limite_credito) || 0,
      color: form.color,
      descripcion: form.descripcion || null,
    }

    const url = editando ? `/api/clientes/grupos/${editando.id}` : '/api/clientes/grupos'
    const method = editando ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    setModal(false)
    router.refresh()
  }

  async function eliminar(g: GrupoConConteo) {
    const count = g.clientes?.[0]?.count ?? 0
    if (count > 0) {
      alert(`No se puede eliminar: el grupo tiene ${count} cliente(s). Cambia el grupo de esos clientes primero.`)
      return
    }
    if (!confirm(`¿Eliminar el grupo "${g.nombre}"?`)) return
    await fetch(`/api/clientes/grupos/${g.id}`, { method: 'DELETE' })
    setGrupos(prev => prev.filter(x => x.id !== g.id))
  }

  const f = (k: keyof FormGrupo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Grupos de clientes</h1>
          <p className="text-sm text-gray-500">{grupos.length} grupo(s) definido(s)</p>
        </div>
        <Button onClick={abrirCrear}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo grupo
        </Button>
      </div>

      {grupos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Tag className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Sin grupos creados</p>
          <p className="text-sm text-gray-400 mb-4">Crea grupos para organizar y dar descuentos a tus clientes</p>
          <Button onClick={abrirCrear} variant="outline"><Plus className="h-4 w-4 mr-2" />Crear primer grupo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map(g => {
            const conteo = g.clientes?.[0]?.count ?? 0
            return (
              <div key={g.id} className="rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: g.color ?? '#3B82F6' }}
                    >
                      {g.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{g.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {conteo} cliente{conteo !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => abrirEditar(g)}
                      className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => eliminar(g)}
                      className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {(g.descuento_porcentaje ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-green-700">
                      <Percent className="h-3 w-3" /> {g.descuento_porcentaje}% descuento
                    </span>
                  )}
                  {(g.limite_credito ?? 0) > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                      Crédito: {formatCOP(g.limite_credito ?? 0)}
                    </span>
                  )}
                </div>

                {g.descripcion && (
                  <p className="mt-2 text-xs text-gray-400 line-clamp-2">{g.descripcion}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        titulo={editando ? 'Editar grupo' : 'Nuevo grupo'}
        size="sm"
      >
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <Input label="Nombre del grupo" value={form.nombre} onChange={f('nombre')} required placeholder="Ej: Clientes VIP" />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Descuento (%)"
              type="number" min="0" max="100" step="0.5"
              value={form.descuento_porcentaje}
              onChange={f('descuento_porcentaje')}
              placeholder="0"
            />
            <Input
              label="Crédito máximo ($)"
              type="number" min="0"
              value={form.limite_credito}
              onChange={f('limite_credito')}
              placeholder="0"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Color identificador</label>
            <div className="flex gap-2 flex-wrap">
              {COLORES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setForm(p => ({ ...p, color: c.value }))}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${form.color === c.value ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Descripción (opcional)</label>
            <textarea
              value={form.descripcion}
              onChange={f('descripcion')}
              rows={2}
              placeholder="Descripción del grupo..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
