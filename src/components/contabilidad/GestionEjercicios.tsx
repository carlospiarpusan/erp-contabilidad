'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil } from 'lucide-react'

interface Ejercicio {
  id: string; año: number; descripcion?: string | null
  fecha_inicio: string; fecha_fin: string; estado: string
}

interface Props { ejercicios: Ejercicio[] }

const BADGE: Record<string, 'success' | 'outline' | 'danger'> = {
  activo: 'success', cerrado: 'outline', bloqueado: 'danger',
}

export function GestionEjercicios({ ejercicios: inicial }: Props) {
  const router = useRouter()
  const [ejercicios, setEjercicios] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Ejercicio | null>(null)
  const [form, setForm] = useState({ año: new Date().getFullYear(), descripcion: '', fecha_inicio: '', fecha_fin: '', estado: 'activo' })
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() {
    const hoy = new Date()
    setEditando(null)
    setForm({
      año: hoy.getFullYear(),
      descripcion: `Ejercicio ${hoy.getFullYear()}`,
      fecha_inicio: `${hoy.getFullYear()}-01-01`,
      fecha_fin:    `${hoy.getFullYear()}-12-31`,
      estado: 'activo',
    })
    setModal(true)
  }

  function abrirEditar(e: Ejercicio) {
    setEditando(e)
    setForm({ año: e.año, descripcion: e.descripcion ?? '', fecha_inicio: e.fecha_inicio, fecha_fin: e.fecha_fin, estado: e.estado })
    setModal(true)
  }

  async function guardar() {
    setGuardando(true)
    try {
      if (editando) {
        const res = await fetch(`/api/contabilidad/ejercicios/${editando.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        const updated = await res.json()
        setEjercicios(prev => prev.map(e => e.id === editando.id ? updated : e))
      } else {
        const res = await fetch('/api/contabilidad/ejercicios', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        })
        const created = await res.json()
        setEjercicios(prev => [created, ...prev])
      }
      setModal(false)
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo ejercicio</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Año</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Inicio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fin</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ejercicios.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin ejercicios</td></tr>
            ) : ejercicios.map(e => (
              <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-bold text-gray-900">{e.año}</td>
                <td className="px-4 py-3 text-gray-700">{e.descripcion ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.fecha_inicio}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.fecha_fin}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={BADGE[e.estado] ?? 'outline'}>{e.estado}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar ejercicio' : 'Nuevo ejercicio'} size="sm">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Año *</label>
              <input type="number" value={form.año} onChange={e => setForm(f => ({ ...f, año: Number(e.target.value) }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} className={inputCls}>
                <option value="activo">Activo</option>
                <option value="cerrado">Cerrado</option>
                <option value="bloqueado">Bloqueado</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin *</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
