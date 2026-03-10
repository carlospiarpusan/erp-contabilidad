'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Star, Edit2, Check, X } from 'lucide-react'

interface Bodega {
  id: string; codigo: string | null; nombre: string; principal: boolean; activa: boolean
}

interface Props { bodegas: Bodega[] }

export function FormBodegas({ bodegas: inicial }: Props) {
  const router = useRouter()
  const [bodegas] = useState(inicial)
  const [editando, setEditando] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [nuevo, setNuevo] = useState({ codigo: '', nombre: '', principal: false })
  const [edit, setEdit] = useState<Omit<Bodega, 'id'>>({ codigo: '', nombre: '', principal: false, activa: true })

  async function guardarNuevo() {
    if (!nuevo.nombre.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/bodegas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAdding(false)
      setNuevo({ codigo: '', nombre: '', principal: false })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  function iniciarEdit(b: Bodega) {
    setEditando(b.id)
    setEdit({ codigo: b.codigo ?? '', nombre: b.nombre, principal: b.principal, activa: b.activa })
  }

  async function guardarEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/bodegas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...edit }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditando(null)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActiva(b: Bodega) {
    const res = await fetch('/api/configuracion/bodegas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, activa: !b.activa }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{bodegas.length} bodega{bodegas.length !== 1 ? 's' : ''}</h3>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
            <Plus className="h-4 w-4 mr-1" /> Nueva bodega
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Código</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Principal</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Activa</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Fila nueva */}
            {adding && (
              <tr className="bg-teal-50">
                <td className="px-4 py-2">
                  <input value={nuevo.codigo} onChange={e => setNuevo(p => ({ ...p, codigo: e.target.value }))}
                    placeholder="BG01" className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </td>
                <td className="px-4 py-2">
                  <input value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Bodega principal" autoFocus
                    className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                </td>
                <td className="px-4 py-2 text-center">
                  <input type="checkbox" checked={nuevo.principal} onChange={e => setNuevo(p => ({ ...p, principal: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-teal-600" />
                </td>
                <td className="px-4 py-2 text-center text-gray-400 text-xs">—</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={guardarNuevo} disabled={saving}
                      className="p-1.5 rounded text-teal-600 hover:bg-teal-100"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setAdding(false)}
                      className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            )}

            {bodegas.length === 0 && !adding ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No hay bodegas</td></tr>
            ) : bodegas.map(b => (
              <tr key={b.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!b.activa ? 'opacity-50' : ''}`}>
                {editando === b.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={edit.codigo ?? ''} onChange={e => setEdit(p => ({ ...p, codigo: e.target.value }))}
                        className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={edit.nombre} onChange={e => setEdit(p => ({ ...p, nombre: e.target.value }))}
                        autoFocus className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={edit.principal} onChange={e => setEdit(p => ({ ...p, principal: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600" />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={edit.activa} onChange={e => setEdit(p => ({ ...p, activa: e.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600" />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => guardarEdit(b.id)} disabled={saving}
                          className="p-1.5 rounded text-teal-600 hover:bg-teal-100"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setEditando(null)}
                          className="p-1.5 rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{b.codigo ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{b.nombre}</td>
                    <td className="px-4 py-3 text-center">
                      {b.principal && <Star className="h-4 w-4 text-yellow-500 mx-auto" />}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActiva(b)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500'}`}>
                        {b.activa ? 'Activa' : 'Inactiva'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => iniciarEdit(b)}
                        className="p-1.5 rounded text-gray-400 hover:text-teal-600 hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
