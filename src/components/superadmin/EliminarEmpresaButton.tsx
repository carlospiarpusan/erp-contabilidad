'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

export function EliminarEmpresaButton({ empresaId, empresaNombre }: { empresaId: string; empresaNombre: string }) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ejecutarDelete(force = false) {
    const suffix = force ? '?force=1' : ''
    const res = await fetch(`/api/superadmin/empresas/${empresaId}${suffix}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  async function handleDelete() {
    if (!confirm(`Vas a eliminar "${empresaNombre}" y todos sus datos asociados. Esta acción es irreversible. ¿Continuar?`)) {
      return
    }

    setGuardando(true)
    setError(null)

    try {
      let { res, data } = await ejecutarDelete()

      if (!res.ok && data?.canForceDelete) {
        const failedCount = Array.isArray(data.failedUsers) ? data.failedUsers.length : 0
        const confirmed = confirm(
          `No se pudieron borrar ${failedCount} usuario(s) en Auth. ¿Quieres forzar la eliminación de la empresa y todos sus datos del ERP de todas formas?`
        )
        if (!confirmed) {
          setGuardando(false)
          setError(data.error ?? 'Eliminación cancelada')
          return
        }
        ;({ res, data } = await ejecutarDelete(true))
      }

      if (!res.ok) throw new Error(data.error ?? 'No fue posible eliminar la empresa')
      if (data.warning) alert(String(data.warning))
      router.push('/superadmin/empresas')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={guardando}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {guardando ? 'Eliminando…' : 'Eliminar empresa'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
