'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Impuesto { id: string; nombre: string; porcentaje: number; tipo?: string | null }
interface Props { impuestos: Impuesto[] }

export function GestionImpuestos({ impuestos: inicial }: Props) {
  const router = useRouter()
  const [impuestos, setImpuestos] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Impuesto | null>(null)
  const [form, setForm] = useState({ nombre: '', porcentaje: 0, tipo: 'IVA' })
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() { setEditando(null); setForm({ nombre: '', porcentaje: 0, tipo: 'IVA' }); setModal(true) }
  function abrirEditar(i: Impuesto) { setEditando(i); setForm({ nombre: i.nombre, porcentaje: i.porcentaje, tipo: i.tipo ?? 'IVA' }); setModal(true) }

  async function guardar() {
    setGuardando(true)
    try {
      if (editando) {
        const res = await fetch(`/api/contabilidad/impuestos/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const updated = await res.json()
        setImpuestos(prev => prev.map(i => i.id === editando.id ? updated : i))
      } else {
        const res = await fetch('/api/contabilidad/impuestos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const created = await res.json()
        setImpuestos(prev => [...prev, created])
      }
      setModal(false); router.refresh()
    } finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este impuesto?')) return
    await fetch(`/api/contabilidad/impuestos/${id}`, { method: 'DELETE' })
    setImpuestos(prev => prev.filter(i => i.id !== id))
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo impuesto</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">%</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {impuestos.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Sin impuestos</td></tr>
            ) : impuestos.map(i => (
              <tr key={i.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{i.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{i.tipo ?? '—'}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900">{i.porcentaje}%</td>
                <td className="px-4 py-3 text-right flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(i.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar impuesto' : 'Nuevo impuesto'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option>IVA</option><option>INC</option><option>Retención</option><option>Otro</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Porcentaje *</label>
              <input type="number" min="0" max="100" step="0.01" value={form.porcentaje} onChange={e => setForm(f => ({ ...f, porcentaje: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.nombre}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
