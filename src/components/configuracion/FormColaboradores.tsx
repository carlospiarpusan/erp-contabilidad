'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Check, X, Trash2 } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface Colaborador {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  porcentaje_comision: number
  meta_mensual: number
  activo: boolean
}

interface Props { colaboradores: Colaborador[] }

const EMPTY = { nombre: '', email: '', telefono: '', porcentaje_comision: '0', meta_mensual: '0' }

export function FormColaboradores({ colaboradores: inicial }: Props) {
  const router = useRouter()
  const [adding, setAdding]     = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [nuevo, setNuevo]       = useState(EMPTY)
  const [edit, setEdit]         = useState({ nombre: '', email: '', telefono: '', porcentaje_comision: '0', meta_mensual: '0', activo: true })

  async function guardarNuevo() {
    if (!nuevo.nombre.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAdding(false)
      setNuevo(EMPTY)
      router.refresh()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  function iniciarEdit(c: Colaborador) {
    setEditando(c.id)
    setEdit({
      nombre: c.nombre,
      email: c.email ?? '',
      telefono: c.telefono ?? '',
      porcentaje_comision: String(c.porcentaje_comision),
      meta_mensual: String(c.meta_mensual),
      activo: c.activo,
    })
  }

  async function guardarEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/colaboradores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...edit }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditando(null)
      router.refresh()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar a ${nombre}?`)) return
    const res = await fetch('/api/configuracion/colaboradores', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) { alert((await res.json()).error); return }
    router.refresh()
  }

  const inp = 'w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500'

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {inicial.length} colaborador{inicial.length !== 1 ? 'es' : ''}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Teléfono</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500">Comisión %</th>
            <th className="px-4 py-3 text-right font-medium text-gray-500">Meta mensual</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {adding && (
            <tr className="bg-orange-50 dark:bg-orange-900/10">
              <td className="px-4 py-2"><input value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre" autoFocus className={inp} /></td>
              <td className="px-4 py-2"><input value={nuevo.email} onChange={e => setNuevo(p => ({ ...p, email: e.target.value }))} placeholder="email@..." className={inp} /></td>
              <td className="px-4 py-2"><input value={nuevo.telefono} onChange={e => setNuevo(p => ({ ...p, telefono: e.target.value }))} placeholder="+57..." className={inp} /></td>
              <td className="px-4 py-2"><input type="number" min="0" max="100" step="0.5" value={nuevo.porcentaje_comision} onChange={e => setNuevo(p => ({ ...p, porcentaje_comision: e.target.value }))} className={inp + ' text-center'} /></td>
              <td className="px-4 py-2"><input type="number" min="0" step="100000" value={nuevo.meta_mensual} onChange={e => setNuevo(p => ({ ...p, meta_mensual: e.target.value }))} className={inp + ' text-right'} /></td>
              <td className="px-4 py-2 text-center text-gray-400 text-xs">—</td>
              <td className="px-4 py-2 text-right">
                <div className="flex gap-1 justify-end">
                  <button onClick={guardarNuevo} disabled={saving} className="p-1.5 rounded text-orange-600 hover:bg-orange-100"><Check className="h-4 w-4" /></button>
                  <button onClick={() => { setAdding(false); setNuevo(EMPTY) }} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          )}

          {inicial.length === 0 && !adding ? (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No hay colaboradores</td></tr>
          ) : inicial.map(c => (
            <tr key={c.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!c.activo ? 'opacity-50' : ''}`}>
              {editando === c.id ? (
                <>
                  <td className="px-4 py-2"><input value={edit.nombre} onChange={e => setEdit(p => ({ ...p, nombre: e.target.value }))} autoFocus className={inp} /></td>
                  <td className="px-4 py-2"><input value={edit.email} onChange={e => setEdit(p => ({ ...p, email: e.target.value }))} className={inp} /></td>
                  <td className="px-4 py-2"><input value={edit.telefono} onChange={e => setEdit(p => ({ ...p, telefono: e.target.value }))} className={inp} /></td>
                  <td className="px-4 py-2"><input type="number" min="0" max="100" step="0.5" value={edit.porcentaje_comision} onChange={e => setEdit(p => ({ ...p, porcentaje_comision: e.target.value }))} className={inp + ' text-center'} /></td>
                  <td className="px-4 py-2"><input type="number" min="0" step="100000" value={edit.meta_mensual} onChange={e => setEdit(p => ({ ...p, meta_mensual: e.target.value }))} className={inp + ' text-right'} /></td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={edit.activo} onChange={e => setEdit(p => ({ ...p, activo: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-orange-600" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => guardarEdit(c.id)} disabled={saving} className="p-1.5 rounded text-orange-600 hover:bg-orange-100"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditando(null)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{c.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{c.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{c.porcentaje_comision}%</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-gray-300">{c.meta_mensual > 0 ? formatCOP(c.meta_mensual) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => iniciarEdit(c)} className="p-1.5 rounded text-gray-400 hover:text-orange-600 hover:bg-gray-100 dark:hover:bg-gray-800"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => eliminar(c.id, c.nombre)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
