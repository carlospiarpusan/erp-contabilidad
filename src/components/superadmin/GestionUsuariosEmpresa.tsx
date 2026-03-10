'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Check, X } from 'lucide-react'

interface Rol { id: string; nombre: string; descripcion?: string }
interface Usuario {
  id: string; nombre: string; email: string; telefono?: string | null
  activo: boolean; created_at: string
  roles: { id: string; nombre: string } | null
}

const ROL_COLOR: Record<string, string> = {
  superadmin:  'bg-violet-100 text-violet-700',
  admin:       'bg-red-100 text-red-700',
  contador:    'bg-blue-100 text-blue-700',
  vendedor:    'bg-green-100 text-green-700',
  solo_lectura:'bg-yellow-100 text-yellow-700',
}

export function GestionUsuariosEmpresa({
  empresa_id, usuarios, roles,
}: {
  empresa_id: string
  usuarios: Usuario[]
  roles: Rol[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', nombre: '', rol_id: '', password: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/empresas/${empresa_id}/usuarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ email: '', nombre: '', rol_id: '', password: '' })
      setShowForm(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarRol(usuario_id: string, rol_id: string) {
    const res = await fetch(`/api/superadmin/empresas/${empresa_id}/usuarios`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, rol_id }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error al cambiar rol'); return }
    router.refresh()
  }

  async function toggleActivo(usuario_id: string, activo: boolean) {
    const res = await fetch(`/api/superadmin/empresas/${empresa_id}/usuarios`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, activo: !activo }),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? 'Error al actualizar'); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Usuarios ({usuarios.length})</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700">
          <UserPlus className="h-3.5 w-3.5" />
          Nuevo usuario
        </button>
      </div>

      {showForm && (
        <form onSubmit={crearUsuario}
          className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { key: 'nombre', label: 'Nombre', type: 'text' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'password', label: 'Contraseña inicial', type: 'password' },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">{f.label} *</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={set(f.key as any)} required
                className="h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm" />
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Rol *</label>
            <select value={form.rol_id} onChange={set('rol_id')} required
              className="h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm">
              <option value="">— Seleccionar —</option>
              {roles.filter(r => r.nombre !== 'superadmin').map(r => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={guardando}
              className="px-3 py-1.5 rounded bg-violet-600 text-white text-sm disabled:opacity-50">
              {guardando ? 'Creando…' : 'Crear usuario'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded border text-sm text-gray-600">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Rol</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Activo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {usuarios.map(u => {
              const rolNombre = u.roles?.nombre ?? ''
              return (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{u.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={u.roles?.id ?? ''}
                      onChange={e => cambiarRol(u.id, e.target.value)}
                      className="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs"
                    >
                      {roles.filter(r => r.nombre !== 'superadmin').map(r => (
                        <option key={r.id} value={r.id}>{r.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActivo(u.id, u.activo)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                      {u.activo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
