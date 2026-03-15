'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface Acreedor {
  id: string; razon_social: string; contacto?: string | null
  numero_documento?: string | null; email?: string | null; telefono?: string | null; activo: boolean
}
interface Props { acreedores: Acreedor[]; total: number }

export function ListaAcreedores({ acreedores: inicial, total }: Props) {
  const router = useRouter()
  const [acreedores, setAcreedores] = useState(inicial)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Acreedor | null>(null)
  const [form, setForm] = useState({ razon_social: '', contacto: '', numero_documento: '', email: '', telefono: '' })
  const [guardando, setGuardando] = useState(false)

  function abrirNuevo() { setEditando(null); setForm({ razon_social: '', contacto: '', numero_documento: '', email: '', telefono: '' }); setModal(true) }
  function abrirEditar(a: Acreedor) {
    setEditando(a)
    setForm({ razon_social: a.razon_social, contacto: a.contacto ?? '', numero_documento: a.numero_documento ?? '', email: a.email ?? '', telefono: a.telefono ?? '' })
    setModal(true)
  }

  async function guardar() {
    if (!form.razon_social.trim()) return
    setGuardando(true)
    try {
      if (editando) {
        const res = await fetch(`/api/gastos/acreedores/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const updated = await res.json()
        if (!res.ok) throw new Error(updated.error ?? 'Error al guardar')
        setAcreedores(prev => prev.map(a => a.id === editando.id ? updated : a))
      } else {
        const res = await fetch('/api/gastos/acreedores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const created = await res.json()
        if (!res.ok) throw new Error(created.error ?? 'Error al crear')
        setAcreedores(prev => [created, ...prev])
      }
      setModal(false); router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function toggleActivo(a: Acreedor) {
    try {
      const res = await fetch(`/api/gastos/acreedores/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !a.activo }) })
      const updated = await res.json()
      if (!res.ok) { alert(updated.error ?? 'Error al actualizar'); return }
      setAcreedores(prev => prev.map(x => x.id === a.id ? updated : x))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error de conexión')
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nuevo acreedor</Button>
      </div>
      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Razón social</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Documento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Contacto</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Activo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {acreedores.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No hay acreedores</td></tr>
            ) : acreedores.map(a => (
              <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-medium text-gray-900">{a.razon_social}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.numero_documento ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {a.contacto ?? '—'}{a.email ? ` · ${a.email}` : ''}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActivo(a)}>
                    {a.activo ? <ToggleRight className="h-5 w-5 text-green-500 mx-auto" /> : <ToggleLeft className="h-5 w-5 text-gray-300 mx-auto" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{total} acreedor{total !== 1 ? 'es' : ''} en total</div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar acreedor' : 'Nuevo acreedor'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Razón social *</label>
            <input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Documento</label>
              <input value={form.numero_documento} onChange={e => setForm(f => ({ ...f, numero_documento: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contacto</label>
              <input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.razon_social.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
