'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Impuesto {
  id: string
  codigo: string
  descripcion: string
  nombre?: string
  porcentaje: number
  porcentaje_recargo?: number | null
}
interface Props { impuestos: Impuesto[] }

export function GestionImpuestos({ impuestos: inicial }: Props) {
  const router = useRouter()
  const [impuestos, setImpuestos] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Impuesto | null>(null)
  const [form, setForm] = useState({ codigo: '', descripcion: '', porcentaje: 0, porcentaje_recargo: 0 })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function abrirNuevo() {
    setError('')
    setEditando(null)
    setForm({ codigo: '', descripcion: '', porcentaje: 0, porcentaje_recargo: 0 })
    setModal(true)
  }
  function abrirEditar(i: Impuesto) {
    setError('')
    setEditando(i)
    setForm({
      codigo: i.codigo ?? '',
      descripcion: i.descripcion ?? i.nombre ?? '',
      porcentaje: i.porcentaje,
      porcentaje_recargo: i.porcentaje_recargo ?? 0,
    })
    setModal(true)
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      if (editando) {
        const res = await fetch(`/api/contabilidad/impuestos/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'No se pudo actualizar el impuesto')
        const updated = body as Impuesto
        setImpuestos(prev => prev.map(i => i.id === editando.id ? updated : i))
      } else {
        const res = await fetch('/api/contabilidad/impuestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'No se pudo crear el impuesto')
        const created = body as Impuesto
        setImpuestos(prev => [...prev, created])
      }
      setModal(false); router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando impuesto')
    } finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este impuesto?')) return
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/impuestos/${id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo eliminar el impuesto')
      setImpuestos(prev => prev.filter(i => i.id !== id))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando impuesto')
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo impuesto</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Código</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">%</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Recargo %</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {impuestos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Sin impuestos</td></tr>
            ) : impuestos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-700">{i.codigo}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{i.descripcion ?? i.nombre ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{i.porcentaje}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-600">{i.porcentaje_recargo ?? 0}%</td>
                <td className="px-4 py-3 text-right flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(i.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar impuesto' : 'Nuevo impuesto'} size="sm">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Código *</label>
              <input
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                className={inputCls}
                placeholder="Ej: CO19"
              />
            </div>
            <div>
              <label className={labelCls}>Porcentaje *</label>
              <input type="number" min="0" max="100" step="0.01" value={form.porcentaje} onChange={e => setForm(f => ({ ...f, porcentaje: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción *</label>
            <input
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className={inputCls}
              placeholder="Ej: IVA 19%"
            />
          </div>
          <div>
            <label className={labelCls}>Recargo (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.porcentaje_recargo}
              onChange={e => setForm(f => ({ ...f, porcentaje_recargo: Number(e.target.value) }))}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.codigo || !form.descripcion}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
