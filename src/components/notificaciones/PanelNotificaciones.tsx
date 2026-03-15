'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { cardCls } from '@/utils/cn'

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje?: string | null
  leida: boolean
  created_at: string
}

export function PanelNotificaciones() {
  const [items, setItems] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/notificaciones?limit=100')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudieron cargar notificaciones')
      setItems(body.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando notificaciones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function marcarLeida(id: string) {
    setError('')
    const prev = items
    setItems(prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    const res = await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setItems(prev)
      setError(body?.error ?? 'No se pudo actualizar la notificación')
    }
  }

  async function marcarTodas() {
    setError('')
    const prev = items
    setItems(prev.map((n) => ({ ...n, leida: true })))
    const res = await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ todas: true }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setItems(prev)
      setError(body?.error ?? 'No se pudieron marcar todas')
    }
  }

  const noLeidas = items.filter((n) => !n.leida).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-blue-600" />
          <p className="text-sm text-gray-600">{noLeidas} sin leer</p>
        </div>
        <Button size="sm" variant="outline" onClick={marcarTodas} disabled={noLeidas === 0}>
          <CheckCheck className="mr-1 h-4 w-4" /> Marcar todas
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
          <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Cargando notificaciones...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          No tienes notificaciones registradas.
        </div>
      ) : (
        <div className={cardCls}>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((n) => (
              <li key={n.id} className={`p-4 ${n.leida ? 'bg-white' : 'bg-blue-50/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{n.titulo}</p>
                    {n.mensaje && <p className="mt-1 text-sm text-gray-600">{n.mensaje}</p>}
                    <p className="mt-1 text-xs text-gray-400">{new Date(n.created_at).toLocaleString('es-CO')}</p>
                  </div>
                  {!n.leida && (
                    <button
                      onClick={() => marcarLeida(n.id)}
                      className="rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Marcar leída
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  )
}
