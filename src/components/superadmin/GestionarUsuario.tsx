'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, X, Check } from 'lucide-react'

interface Rol { id: string; nombre: string }
interface Props {
  usuario: { id: string; nombre: string; activo: boolean; rol_id: string; empresa_id: string }
  roles: Rol[]
}

export function GestionarUsuario({ usuario, roles }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rolId, setRolId] = useState(usuario.rol_id)
  const [activo, setActivo] = useState(usuario.activo)
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setGuardando(true)
    await fetch(`/api/superadmin/empresas/${usuario.empresa_id}/usuarios`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuario.id, rol_id: rolId, activo }),
    })
    setGuardando(false)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-xs text-violet-600 hover:text-violet-800 hover:underline flex items-center gap-1">
        <Settings className="h-3 w-3" /> Editar
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select value={rolId} onChange={e => setRolId(e.target.value)}
        className="h-7 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 text-xs">
        {roles.filter(r => r.nombre !== 'superadmin').map(r => (
          <option key={r.id} value={r.id}>{r.nombre}</option>
        ))}
      </select>
      <button onClick={() => setActivo(v => !v)}
        className={`h-7 px-2 rounded text-xs font-medium ${activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {activo ? 'Activo' : 'Inactivo'}
      </button>
      <button onClick={guardar} disabled={guardando}
        className="h-7 w-7 flex items-center justify-center rounded bg-violet-600 text-white disabled:opacity-50">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button onClick={() => setOpen(false)}
        className="h-7 w-7 flex items-center justify-center rounded border text-gray-500">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
