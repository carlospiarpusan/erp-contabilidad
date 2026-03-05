'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Edit2, Check, X, ExternalLink } from 'lucide-react'

interface Transportadora {
  id: string; nombre: string; whatsapp: string | null; url_rastreo: string | null; activa: boolean
}

interface Props { transportadoras: Transportadora[] }

const EMPTY = { nombre: '', whatsapp: '', url_rastreo: '' }

export function FormTransportadoras({ transportadoras: inicial }: Props) {
  const router = useRouter()
  const [adding, setAdding]     = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [nuevo, setNuevo]       = useState(EMPTY)
  const [edit, setEdit]         = useState({ nombre: '', whatsapp: '', url_rastreo: '', activa: true })

  async function guardarNuevo() {
    if (!nuevo.nombre.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/transportadoras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setAdding(false)
      setNuevo(EMPTY)
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  function iniciarEdit(t: Transportadora) {
    setEditando(t.id)
    setEdit({ nombre: t.nombre, whatsapp: t.whatsapp ?? '', url_rastreo: t.url_rastreo ?? '', activa: t.activa })
  }

  async function guardarEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/transportadoras', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...edit }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditando(null)
      router.refresh()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActiva(t: Transportadora) {
    await fetch('/api/configuracion/transportadoras', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, activa: !t.activa }),
    })
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">{inicial.length} transportadora{inicial.length !== 1 ? 's' : ''}</h3>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-4 w-4 mr-1" /> Nueva
        </Button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">WhatsApp</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">URL rastreo</th>
            <th className="px-4 py-3 text-center font-medium text-gray-500">Estado</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {adding && (
            <tr className="bg-indigo-50">
              <td className="px-4 py-2">
                <input value={nuevo.nombre} onChange={e => setNuevo(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Servientrega" autoFocus
                  className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </td>
              <td className="px-4 py-2">
                <input value={nuevo.whatsapp} onChange={e => setNuevo(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="+57 300 000 0000"
                  className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </td>
              <td className="px-4 py-2">
                <input value={nuevo.url_rastreo} onChange={e => setNuevo(p => ({ ...p, url_rastreo: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </td>
              <td className="px-4 py-2 text-center text-gray-400 text-xs">—</td>
              <td className="px-4 py-2 text-right">
                <div className="flex gap-1 justify-end">
                  <button onClick={guardarNuevo} disabled={saving}
                    className="p-1.5 rounded text-indigo-600 hover:bg-indigo-100"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setAdding(false)}
                    className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          )}

          {inicial.length === 0 && !adding ? (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No hay transportadoras</td></tr>
          ) : inicial.map(t => (
            <tr key={t.id} className={`hover:bg-gray-50 ${!t.activa ? 'opacity-50' : ''}`}>
              {editando === t.id ? (
                <>
                  <td className="px-4 py-2">
                    <input value={edit.nombre} onChange={e => setEdit(p => ({ ...p, nombre: e.target.value }))} autoFocus
                      className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </td>
                  <td className="px-4 py-2">
                    <input value={edit.whatsapp} onChange={e => setEdit(p => ({ ...p, whatsapp: e.target.value }))}
                      className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </td>
                  <td className="px-4 py-2">
                    <input value={edit.url_rastreo} onChange={e => setEdit(p => ({ ...p, url_rastreo: e.target.value }))}
                      className="w-full h-8 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="checkbox" checked={edit.activa} onChange={e => setEdit(p => ({ ...p, activa: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => guardarEdit(t.id)} disabled={saving}
                        className="p-1.5 rounded text-indigo-600 hover:bg-indigo-100"><Check className="h-4 w-4" /></button>
                      <button onClick={() => setEditando(null)}
                        className="p-1.5 rounded text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 font-medium text-gray-800">{t.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{t.whatsapp ?? '—'}</td>
                  <td className="px-4 py-3">
                    {t.url_rastreo ? (
                      <a href={t.url_rastreo} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs">
                        <ExternalLink className="h-3 w-3" /> Rastrear
                      </a>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActiva(t)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => iniciarEdit(t)}
                      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-gray-100">
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
  )
}
