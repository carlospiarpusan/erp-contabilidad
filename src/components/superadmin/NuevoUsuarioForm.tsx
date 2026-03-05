'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'

interface Empresa { id: string; nombre: string }
interface Rol { id: string; nombre: string }

export function NuevoUsuarioForm({ empresas, roles }: { empresas: Empresa[]; roles: Rol[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', empresa_id: '', rol_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.empresa_id || !form.rol_id) { setError('Selecciona empresa y rol'); return }
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/empresas/${form.empresa_id}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: form.nombre, email: form.email, password: form.password, rol_id: form.rol_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ nombre: '', email: '', password: '', empresa_id: '', rol_id: '' })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">
        <UserPlus className="h-4 w-4" /> Nuevo usuario
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-violet-900 dark:text-violet-300">Crear nuevo usuario</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Nombre *</label>
          <input type="text" value={form.nombre} onChange={set('nombre')} required
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Email *</label>
          <input type="email" value={form.email} onChange={set('email')} required
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Contraseña *</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={6}
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Empresa *</label>
          <select value={form.empresa_id} onChange={set('empresa_id')} required
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm">
            <option value="">— Seleccionar —</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rol *</label>
          <select value={form.rol_id} onChange={set('rol_id')} required
            className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm">
            <option value="">— Seleccionar —</option>
            {roles.filter(r => r.nombre !== 'superadmin').map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        <div className="sm:col-span-2 flex gap-2 pt-1">
          <button type="submit" disabled={guardando}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-violet-700">
            {guardando ? 'Creando…' : 'Crear usuario'}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
