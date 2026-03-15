'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Familia } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { cn, cardCls } from '@/utils/cn'

type FamiliaConConteo = Familia & { productos: { count: number }[] }

interface Props { familias: FamiliaConConteo[] }

export function Familias({ familias: init }: Props) {
  const router = useRouter()
  const [familias, setFamilias] = useState(init)
  const [modal, setModal]       = useState(false)
  const [editando, setEditando] = useState<FamiliaConConteo | null>(null)
  const [nombre, setNombre]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  function abrir(f?: FamiliaConConteo) {
    setEditando(f ?? null)
    setNombre(f?.nombre ?? '')
    setError('')
    setModal(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const url    = editando ? `/api/productos/familias/${editando.id}` : '/api/productos/familias'
      const method = editando ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre }) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setModal(false)
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(f: FamiliaConConteo) {
    const count = f.productos?.[0]?.count ?? 0
    if (count > 0) {
      alert(`No se puede eliminar: la familia tiene ${count} producto(s). Cambia la familia de esos productos primero.`)
      return
    }
    if (!confirm(`¿Eliminar la familia "${f.nombre}"?`)) return
    const res = await fetch(`/api/productos/familias/${f.id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error al eliminar'); return }
    setFamilias(prev => prev.filter(x => x.id !== f.id))
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{familias.length} familia(s) definida(s)</p>
        <Button onClick={() => abrir()}>
          <Plus className="h-4 w-4 mr-2" /> Nueva familia
        </Button>
      </div>

      {familias.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Tag className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Sin familias creadas</p>
          <p className="text-sm text-gray-400 mb-4">Organiza tus productos por categorías</p>
          <Button onClick={() => abrir()} variant="outline"><Plus className="h-4 w-4 mr-2" />Crear primera familia</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {familias.map(f => {
            const conteo = f.productos?.[0]?.count ?? 0
            return (
              <div key={f.id} className={cn('flex items-center justify-between', cardCls, 'p-4 hover:shadow-sm transition-shadow')}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700 font-bold text-sm">
                    {(f.nombre ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{f.nombre}</p>
                    <p className="text-xs text-gray-400">{conteo} producto{conteo !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrir(f)} className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => eliminar(f)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar familia' : 'Nueva familia'} size="sm">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <Input label="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Ej: Fajas Reductoras" />
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
