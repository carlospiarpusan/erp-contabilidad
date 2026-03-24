'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Trash2, X } from 'lucide-react'

interface Rol {
  id: string
  nombre: string
}

interface Empresa {
  id: string
  nombre: string
}

interface Props {
  usuario: {
    id: string
    nombre: string
    email: string
    activo: boolean
    rol_id: string
    empresa_id: string
  }
  roles: Rol[]
  empresas?: Empresa[]
  currentUserId?: string
}

export function GestionarUsuario({ usuario, roles, empresas, currentUserId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    email: usuario.email,
    rol_id: usuario.rol_id,
    empresa_id: usuario.empresa_id,
    activo: usuario.activo,
    password: '',
  })

  const availableRoles = empresas ? roles : roles.filter((role) => role.nombre !== 'superadmin')
  const canDelete = currentUserId !== usuario.id

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const nextValue = event.target.type === 'checkbox'
      ? (event.target as HTMLInputElement).checked
      : event.target.value
    setForm((prev) => ({ ...prev, [key]: nextValue }))
  }

  async function guardar() {
    setGuardando(true)
    setError(null)

    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        rol_id: form.rol_id,
        empresa_id: form.empresa_id,
        activo: form.activo,
        ...(form.password ? { password: form.password } : {}),
      }

      const res = await fetch(`/api/superadmin/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'No fue posible actualizar el usuario')
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!canDelete) return
    if (!confirm(`Vas a eliminar a ${usuario.nombre}. Esta acción también elimina su acceso al sistema. ¿Continuar?`)) return

    setGuardando(true)
    setError(null)
    try {
      let res = await fetch(`/api/superadmin/usuarios/${usuario.id}`, { method: 'DELETE' })
      let data = await res.json().catch(() => ({}))

      if (!res.ok && data?.canForceDelete) {
        const confirmed = confirm(
          `No se pudo borrar el usuario en Auth. ¿Quieres forzar su eliminación del ERP de todas formas?`
        )
        if (!confirmed) {
          setGuardando(false)
          setError(data.error ?? 'Eliminación cancelada')
          return
        }
        res = await fetch(`/api/superadmin/usuarios/${usuario.id}?force=1`, { method: 'DELETE' })
        data = await res.json().catch(() => ({}))
      }

      if (!res.ok) throw new Error(data.error ?? 'No fue posible eliminar el usuario')
      if (data.warning) alert(String(data.warning))
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:underline"
      >
        <Pencil className="h-3 w-3" />
        Editar
      </button>
    )
  }

  return (
    <div className="min-w-[19rem] rounded-xl border border-violet-200 bg-violet-50 p-4 text-left shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-violet-900">Editar usuario</p>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Nombre</label>
          <input
            value={form.nombre}
            onChange={set('nombre')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={set('email')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
          />
        </div>
        {empresas && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Empresa</label>
            <select
              value={form.empresa_id}
              onChange={set('empresa_id')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>{empresa.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rol</label>
          <select
            value={form.rol_id}
            onChange={set('rol_id')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
          >
            {availableRoles.map((rol) => (
              <option key={rol.id} value={rol.id}>{rol.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Nueva contraseña</label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="Opcional"
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={set('activo')}
            className="h-4 w-4 rounded border-gray-300 text-violet-600"
          />
          Usuario activo
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={guardar}
            disabled={guardando}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Guardar
          </button>
          {canDelete && (
            <button
              onClick={eliminar}
              disabled={guardando}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
