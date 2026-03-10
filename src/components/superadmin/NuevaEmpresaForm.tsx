'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NuevaEmpresaForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', nit: '', email_admin: '', nombre_admin: '', password_admin: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ nombre: '', nit: '', email_admin: '', nombre_admin: '', password_admin: '' })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Nombre de empresa *</label>
        <input value={form.nombre} onChange={set('nombre')} required
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">NIT *</label>
        <input value={form.nit} onChange={set('nit')} required
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Email del administrador *</label>
        <input type="email" value={form.email_admin} onChange={set('email_admin')} required
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Nombre del administrador *</label>
        <input value={form.nombre_admin} onChange={set('nombre_admin')} required
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-gray-600">Contraseña inicial del administrador *</label>
        <input type="password" value={form.password_admin} onChange={set('password_admin')} required minLength={6}
          className="h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
      </div>
      {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={guardando}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
          {guardando ? 'Creando…' : 'Crear empresa'}
        </button>
      </div>
    </form>
  )
}
