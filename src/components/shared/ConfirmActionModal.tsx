'use client'

import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface ConfirmActionModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  titulo: string
  descripcion: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'success' | 'warning' | 'link'
  loading?: boolean
}

export function ConfirmActionModal({
  open,
  onClose,
  onConfirm,
  titulo,
  descripcion,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'destructive',
  loading = false,
}: ConfirmActionModalProps) {
  return (
    <Modal open={open} onClose={onClose} titulo={titulo} descripcion={descripcion} size="sm">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={() => void onConfirm()} disabled={loading}>
          {loading ? 'Procesando...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
