'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pencil, Check, X } from 'lucide-react'

interface Consecutivo {
  id: string; tipo: string; descripcion: string
  prefijo: string; consecutivo_actual: number; activo: boolean
}

interface Props { consecutivos: Consecutivo[] }

export function GestionConsecutivos({ consecutivos: inicial }: Props) {
  const [consecutivos, setConsecutivos] = useState(inicial)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ prefijo: '', consecutivo_actual: 0 })
  const [guardando, setGuardando] = useState(false)

  function startEdit(c: Consecutivo) {
    setEditandoId(c.id)
    setEditForm({ prefijo: c.prefijo, consecutivo_actual: c.consecutivo_actual })
  }

  async function save(id: string) {
    setGuardando(true)
    try {
      const res = await fetch(`/api/contabilidad/consecutivos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const updated = await res.json()
      setConsecutivos(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c))
      setEditandoId(null)
    } finally { setGuardando(false) }
  }

  const inputCls = 'rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Prefijo</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Actual</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Próximo</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {consecutivos.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Sin consecutivos</td></tr>
          ) : consecutivos.map(c => (
            <tr key={c.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.tipo}</td>
              <td className="px-4 py-3 text-gray-900">{c.descripcion}</td>
              <td className="px-4 py-3">
                {editandoId === c.id ? (
                  <input value={editForm.prefijo} onChange={e => setEditForm(f => ({ ...f, prefijo: e.target.value }))} className={inputCls + ' w-20'} />
                ) : (
                  <span className="font-mono text-gray-700">{c.prefijo || '(sin prefijo)'}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {editandoId === c.id ? (
                  <input type="number" min="0" value={editForm.consecutivo_actual}
                    onChange={e => setEditForm(f => ({ ...f, consecutivo_actual: Number(e.target.value) }))}
                    className={inputCls + ' w-24 text-right'} />
                ) : (
                  <span className="font-mono text-gray-700">{c.consecutivo_actual}</span>
                )}
              </td>
              <td className="px-4 py-3 text-right font-mono text-blue-600">
                {editandoId === c.id ? editForm.consecutivo_actual + 1 : c.consecutivo_actual + 1}
              </td>
              <td className="px-4 py-3 text-right">
                {editandoId === c.id ? (
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => save(c.id)} disabled={guardando}><Check className="h-3.5 w-3.5 text-green-600" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}><X className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
