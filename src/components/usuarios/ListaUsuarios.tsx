'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UsuarioRow } from '@/lib/db/usuarios'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { UserPlus, Shield, UserCheck, UserX } from 'lucide-react'

const ROL_COLORES: Record<string, 'default' | 'success' | 'warning' | 'info' | 'danger'> = {
  admin:       'danger',
  contador:    'info',
  vendedor:    'success',
  solo_lectura:'warning',
}

interface Props {
  usuarios: UsuarioRow[]
  roles: { id: string; nombre: string; descripcion: string }[]
}

export function ListaUsuarios({ usuarios: init, roles }: Props) {
  const router   = useRouter()
  const [lista, setLista] = useState(init)
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', nombre: '', rol_id: '' })

  async function invitar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setModal(false)
    setForm({ email: '', nombre: '', rol_id: '' })
    router.refresh()
  }

  async function cambiarRol(id: string, rol_id: string) {
    await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol_id }),
    })
    setLista(prev => prev.map(u => u.id === id ? { ...u, rol_id } : u))
  }

  async function toggleActivo(id: string, activo: boolean) {
    await fetch(`/api/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !activo }),
    })
    setLista(prev => prev.map(u => u.id === id ? { ...u, activo: !activo } : u))
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios del sistema</h1>
          <p className="text-sm text-gray-500">{lista.length} usuario(s) registrado(s)</p>
        </div>
        <Button onClick={() => setModal(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar usuario
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Registrado</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{u.nombre}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.rol_id ?? ''}
                    onChange={e => cambiarRol(u.id, e.target.value)}
                    className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.nombre}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={u.activo ? 'success' : 'warning'}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(u.created_at).toLocaleDateString('es-CO')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1">
                    <button
                      onClick={() => toggleActivo(u.id, u.activo)}
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      {u.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal invitar */}
      <Modal open={modal} onClose={() => setModal(false)} titulo="Invitar usuario" size="sm">
        <form onSubmit={invitar} className="flex flex-col gap-4">
          <Input
            label="Nombre completo"
            placeholder="Ej: Ana García"
            value={form.nombre}
            onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
            required
          />
          <Input
            label="Correo electrónico"
            type="email"
            placeholder="usuario@empresa.com"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            required
          />
          <Select
            label="Rol"
            value={form.rol_id}
            onChange={e => setForm(p => ({ ...p, rol_id: e.target.value }))}
            options={roles.map(r => ({ value: r.id, label: r.nombre }))}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Invitando...' : 'Invitar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
