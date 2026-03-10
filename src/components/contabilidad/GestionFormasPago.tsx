'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface CuentaPUC { codigo: string; descripcion: string }
interface FormaPago {
  id: string; descripcion: string; tipo: string
  dias_vencimiento?: number | null; activo: boolean
  cuenta_id?: string | null
  cuenta?: CuentaPUC | null
}

interface CuentaOpcion { id: string; codigo: string; descripcion: string }

interface Props {
  formasPago: FormaPago[]
  cuentas: CuentaOpcion[]
}

export function GestionFormasPago({ formasPago: inicial, cuentas }: Props) {
  const router = useRouter()
  const [formasPago, setFormasPago] = useState(inicial)
  const [modal, setModal]     = useState(false)
  const [editando, setEditando] = useState<FormaPago | null>(null)
  const [form, setForm] = useState({ descripcion: '', tipo: 'contado', dias_vencimiento: 0, cuenta_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function abrirNuevo() { setEditando(null); setForm({ descripcion: '', tipo: 'contado', dias_vencimiento: 0, cuenta_id: '' }); setModal(true) }
  function abrirEditar(f: FormaPago) {
    setEditando(f)
    setForm({ descripcion: f.descripcion, tipo: f.tipo, dias_vencimiento: f.dias_vencimiento ?? 0, cuenta_id: f.cuenta_id ?? '' })
    setModal(true)
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    try {
      if (editando) {
        const res = await fetch(`/api/contabilidad/formas-pago/${editando.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'No se pudo actualizar la forma de pago')
        const updated = body as FormaPago
        setFormasPago(prev => prev.map(f => f.id === editando.id ? { ...f, ...updated } : f))
      } else {
        const res = await fetch('/api/contabilidad/formas-pago', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? 'No se pudo crear la forma de pago')
        const created = body as FormaPago
        setFormasPago(prev => [...prev, created])
      }
      setModal(false); router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando forma de pago')
    } finally { setGuardando(false) }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta forma de pago?')) return
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/formas-pago/${id}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo eliminar la forma de pago')
      setFormasPago(prev => prev.filter(f => f.id !== id))
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando forma de pago')
    }
  }

  async function toggleActivo(f: FormaPago) {
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/formas-pago/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activo: !f.activo }) })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo actualizar el estado')
      const updated = body as FormaPago
      setFormasPago(prev => prev.map(x => x.id === f.id ? { ...x, ...updated } : x))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error actualizando estado')
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={abrirNuevo}><Plus className="h-4 w-4 mr-1" /> Nueva forma de pago</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Días</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cuenta PUC</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Activo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {formasPago.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin formas de pago</td></tr>
            ) : formasPago.map(f => (
              <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950/50">
                <td className="px-4 py-3 font-medium text-gray-900">{f.descripcion}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{f.tipo}</td>
                <td className="px-4 py-3 text-right text-gray-500">{f.dias_vencimiento ?? 0}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                  {(f.cuenta as CuentaPUC | null)?.codigo ?? '—'} {(f.cuenta as CuentaPUC | null)?.descripcion ?? ''}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActivo(f)}>
                    {f.activo ? <ToggleRight className="h-5 w-5 text-green-500 mx-auto" /> : <ToggleLeft className="h-5 w-5 text-gray-300 mx-auto" />}
                  </button>
                </td>
                <td className="px-4 py-3 text-right flex gap-1 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => abrirEditar(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => eliminar(f.id)} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Modal open={modal} onClose={() => setModal(false)} titulo={editando ? 'Editar forma de pago' : 'Nueva forma de pago'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Descripción *</label>
            <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} />
          </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
                <option value="contado">Contado</option>
                <option value="credito">Crédito</option>
                <option value="anticipo">Anticipo</option>
                <option value="anticipado">Anticipado</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Días vencimiento</label>
              <input type="number" min="0" value={form.dias_vencimiento} onChange={e => setForm(f => ({ ...f, dias_vencimiento: Number(e.target.value) }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Cuenta PUC</label>
            <select value={form.cuenta_id} onChange={e => setForm(f => ({ ...f, cuenta_id: e.target.value }))} className={inputCls}>
              <option value="">— Sin cuenta específica —</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Para Sistecrédito asigna aquí la cuenta por cobrar del convenio.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModal(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.descripcion}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
