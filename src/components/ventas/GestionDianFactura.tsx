'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, FileCheck, XCircle } from 'lucide-react'

interface Props {
  facturaId: string
  dianEstado?: string | null
  cufe?: string | null
  qrUrl?: string | null
}

const ESTADO_COLOR: Record<string, string> = {
  enviada: 'bg-amber-100 text-amber-700',
  aceptada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
}

export function GestionDianFactura({ facturaId, dianEstado, cufe, qrUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function enviar() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ventas/facturas/${facturaId}/dian`, { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo enviar a DIAN')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar a DIAN')
    } finally {
      setLoading(false)
    }
  }

  async function setEstado(estado: 'aceptada' | 'rechazada') {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ventas/facturas/${facturaId}/dian`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dian_estado: estado }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo actualizar estado DIAN')
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error actualizando estado DIAN')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Facturación electrónica (DIAN)</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[dianEstado ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
          {dianEstado ?? 'sin enviar'}
        </span>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <p><strong>CUFE:</strong> {cufe ?? '—'}</p>
        <p>
          <strong>QR:</strong>{' '}
          {qrUrl ? (
            <a href={qrUrl} target="_blank" className="text-blue-600 hover:underline" rel="noreferrer">
              Ver QR
            </a>
          ) : '—'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={enviar} disabled={loading}>
          <FileCheck className="mr-1 h-4 w-4" /> {loading ? 'Enviando...' : 'Enviar a DIAN'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEstado('aceptada')} disabled={loading || dianEstado === 'aceptada'}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Marcar aceptada
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEstado('rechazada')} disabled={loading || dianEstado === 'rechazada'}>
          <XCircle className="mr-1 h-4 w-4" /> Marcar rechazada
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
