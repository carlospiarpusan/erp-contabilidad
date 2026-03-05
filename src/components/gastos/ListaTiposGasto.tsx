'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface CuentaPUC { codigo: string; descripcion: string }
interface TipoGasto {
  id: string; descripcion: string; valor_estimado?: number | null
  cuenta?: CuentaPUC | null
}
interface Props { tipos: TipoGasto[] }

export function ListaTiposGasto({ tipos: inicial }: Props) {
  const router = useRouter()
  const [tipos, setTipos] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<TipoGasto | null>(null)
  const [form, setForm] = useState({ descripcion: '', valor_estimado: 0 })
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() { setEditando(null); setForm({ descripcion: '', valor_estimado: 0 }); setModal(true) }
  function abrirEditar(t: TipoGasto) {
    setEditando(t)
    setForm({ descripcion: t.descripcion, valor_estimado: t.valor_estimado ?? 0 })
    setModal(true)
  }

  async function guardar() {
    if (!form.descripcion.trim()) return
    setGuardando(true)
    try {
      if (editando) {
        const res = await fetch(`/api/gastos/tipos/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const updated = await res.json()
        setTipos(prev => prev.map(t => t.id === editando.id ? { ...t, ...updated } : t))
      } else {
        const res = await fetch('/api/gastos/tipos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const created = await res.json()
        setTipos(prev => [...prev, created])
      }
      setModal(false); router.refresh()
    } finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este tipo de gasto?')) return
    await fetch(`/api/gastos/tipos/${id}`, { method: 'DELETE' })
    setTipos(prev => prev.filter(t => t.id !== id))
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo tipo</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cuenta PUC</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Valor estimado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tipos.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No hay tipos de gasto</td></tr>
            ) : tipos.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.descripcion}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {(t.cuenta as CuentaPUC | null)?.codigo ?? '—'} {(t.cuenta as CuentaPUC | null)?.descripcion ?? ''}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {t.valor_estimado ? formatCOP(t.valor_estimado) : '—'}
                </td>
                <td className="px-4 py-3 text-right flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(t.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar tipo' : 'Nuevo tipo de gasto'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Descripción *</label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valor estimado mensual</label>
            <input type="number" min="0" step="1000" value={form.valor_estimado} onChange={e => setForm(f => ({ ...f, valor_estimado: Number(e.target.value) }))} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.descripcion.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
