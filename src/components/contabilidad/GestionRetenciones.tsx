'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cardCls } from '@/utils/cn'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

interface Retencion {
  id: string; tipo: string; nombre: string
  porcentaje: number; base_minima: number; base_uvt?: number | null
  aplica_a: string; activa: boolean
}

interface Props { retenciones: Retencion[] }

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'
const thCls = 'px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500'

const TIPOS: Record<string, string> = {
  retefuente: 'Retefuente',
  reteica: 'ReteICA',
  reteiva: 'ReteIVA',
}

const APLICA_A: Record<string, string> = {
  compras: 'Compras',
  ventas: 'Ventas',
  ambos: 'Ambos',
}

export function GestionRetenciones({ retenciones: inicial }: Props) {
  const router = useRouter()
  const [retenciones, setRetenciones] = useState(inicial)
  const [modalForm, setModalForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    tipo: 'retefuente', nombre: '', porcentaje: '', base_minima: '', base_uvt: '', aplica_a: 'compras',
  })

  function abrirNueva() {
    setEditandoId(null)
    setForm({ tipo: 'retefuente', nombre: '', porcentaje: '', base_minima: '', base_uvt: '', aplica_a: 'compras' })
    setError('')
    setModalForm(true)
  }

  function abrirEditar(r: Retencion) {
    setEditandoId(r.id)
    setForm({
      tipo: r.tipo, nombre: r.nombre,
      porcentaje: String(r.porcentaje),
      base_minima: String(r.base_minima),
      base_uvt: r.base_uvt ? String(r.base_uvt) : '',
      aplica_a: r.aplica_a,
    })
    setError('')
    setModalForm(true)
  }

  async function guardar() {
    setGuardando(true); setError('')
    try {
      const url = '/api/contabilidad/retenciones'
      const method = editandoId ? 'PATCH' : 'POST'
      const payload = editandoId ? { id: editandoId, ...form } : form

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error')

      if (editandoId) {
        setRetenciones(prev => prev.map(r => r.id === editandoId ? body : r))
      } else {
        setRetenciones(prev => [...prev, body])
      }
      setModalForm(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function toggleActiva(r: Retencion) {
    try {
      const res = await fetch('/api/contabilidad/retenciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, activa: !r.activa }),
      })
      if (!res.ok) throw new Error('Error')
      const updated = await res.json()
      setRetenciones(prev => prev.map(x => x.id === r.id ? updated : x))
    } catch { /* ignore */ }
  }

  const grouped = {
    retefuente: retenciones.filter(r => r.tipo === 'retefuente'),
    reteica: retenciones.filter(r => r.tipo === 'reteica'),
    reteiva: retenciones.filter(r => r.tipo === 'reteiva'),
  }

  return (
    <div className="flex flex-col gap-6">
      {error && !modalForm && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end">
        <Button size="sm" onClick={abrirNueva}>
          <Plus className="h-4 w-4 mr-1" /> Nueva retención
        </Button>
      </div>

      {Object.entries(grouped).map(([tipo, items]) => (
        <div key={tipo}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{TIPOS[tipo]}</h3>
          <div className={`overflow-x-auto ${cardCls}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className={thCls}>Nombre</th>
                  <th className={`${thCls} text-center`}>Porcentaje</th>
                  <th className={`${thCls} text-right`}>Base mínima</th>
                  <th className={`${thCls} text-center`}>Base UVT</th>
                  <th className={`${thCls} text-center`}>Aplica a</th>
                  <th className={`${thCls} text-center`}>Estado</th>
                  <th className={`${thCls} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {items.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-xs">Sin retenciones de tipo {TIPOS[tipo]}</td></tr>
                ) : items.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.nombre}</td>
                    <td className="px-4 py-3 text-center font-mono text-teal-700 dark:text-teal-400 font-semibold">{r.porcentaje}%</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {r.base_minima > 0 ? `$${r.base_minima.toLocaleString('es-CO')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {r.base_uvt ? `${r.base_uvt} UVT` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={r.aplica_a === 'ambos' ? 'info' : 'default'}>
                        {APLICA_A[r.aplica_a] ?? r.aplica_a}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={r.activa ? 'success' : 'default'}>
                        {r.activa ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => toggleActiva(r)}>
                          {r.activa ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-300" />}
                        </button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Modal formulario */}
      <Modal open={modalForm} onClose={() => setModalForm(false)} titulo={editandoId ? 'Editar retención' : 'Nueva retención'} size="md">
        <div className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputCls} disabled={!!editandoId}>
                <option value="retefuente">Retefuente</option>
                <option value="reteica">ReteICA</option>
                <option value="reteiva">ReteIVA</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Aplica a *</label>
              <select value={form.aplica_a} onChange={e => setForm(f => ({ ...f, aplica_a: e.target.value }))} className={inputCls}>
                <option value="compras">Compras</option>
                <option value="ventas">Ventas</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: Retefuente Compras 2.5%" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Porcentaje (%) *</label>
              <input type="number" min="0" step="0.01" value={form.porcentaje} onChange={e => setForm(f => ({ ...f, porcentaje: e.target.value }))} className={inputCls} placeholder="2.5" />
            </div>
            <div>
              <label className={labelCls}>Base mínima ($)</label>
              <input type="number" min="0" step="1000" value={form.base_minima} onChange={e => setForm(f => ({ ...f, base_minima: e.target.value }))} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Base UVT</label>
              <input type="number" min="0" step="1" value={form.base_uvt} onChange={e => setForm(f => ({ ...f, base_uvt: e.target.value }))} className={inputCls} placeholder="27" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={guardar} disabled={guardando || !form.nombre || !form.porcentaje}>
              {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear retención'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
