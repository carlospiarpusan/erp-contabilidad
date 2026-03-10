'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'
import { ConfirmActionModal } from '@/components/shared/ConfirmActionModal'

interface Props {
  asientoId: string
  disabled?: boolean
}

export function RevertirAsientoButton({ asientoId, disabled }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  async function revertir() {
    if (disabled) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/contabilidad/asientos/${asientoId}/revertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo revertir el asiento')
      setOpen(false)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al revertir')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" disabled={loading || disabled} onClick={() => setOpen(true)}>
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        {loading ? 'Revirtiendo...' : 'Revertir'}
      </Button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      <ConfirmActionModal
        open={open}
        onClose={() => !loading && setOpen(false)}
        onConfirm={revertir}
        titulo="Revertir asiento"
        descripcion="Se creará un asiento de reversión con débitos y créditos invertidos."
        confirmLabel="Revertir"
        confirmVariant="warning"
        loading={loading}
      />
    </div>
  )
}
