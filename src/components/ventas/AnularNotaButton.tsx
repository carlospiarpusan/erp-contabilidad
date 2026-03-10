'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Ban } from 'lucide-react'
import { ConfirmActionModal } from '@/components/shared/ConfirmActionModal'

interface Props {
  apiPath: string
  tipoLabel: string
  disabled?: boolean
}

export function AnularNotaButton({ apiPath, tipoLabel, disabled }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [open, setOpen] = useState(false)

  async function anular() {
    if (disabled) return
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const res = await fetch(apiPath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'anular' }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? `No se pudo anular ${tipoLabel}`)
      if (body?.warning) {
        setWarning(String(body.warning))
      }
      setOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al anular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={loading || disabled} onClick={() => setOpen(true)}>
        <Ban className="mr-1 h-4 w-4" />
        {loading ? 'Anulando...' : 'Anular'}
      </Button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {warning && <span className="text-[11px] text-amber-700">{warning}</span>}
      <ConfirmActionModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        onConfirm={anular}
        titulo={`Anular ${tipoLabel}`}
        descripcion="Se intentará generar reversión contable automática para dejar trazabilidad."
        confirmLabel="Anular"
        confirmVariant="destructive"
        loading={loading}
      />
    </div>
  )
}
