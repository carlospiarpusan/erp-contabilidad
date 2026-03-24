'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, Paperclip, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardCls, cn } from '@/utils/cn'

type RelationType = 'documento' | 'asiento' | 'recibo' | 'pago_proveedor' | 'documento_soporte'

export interface AdjuntoItem {
  id: string
  nombre_archivo: string
  mime_type?: string | null
  tamaño_bytes: number
  tipo_documental: string
  created_at: string
}

interface Props {
  relationType: RelationType
  relationId: string
  tipoDocumental: string
  initialItems?: AdjuntoItem[]
  linkedIds?: {
    documento_id?: string | null
    asiento_id?: string | null
    recibo_id?: string | null
    pago_proveedor_id?: string | null
  }
  onChange?: (items: AdjuntoItem[]) => void
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function AdjuntosPrivados({
  relationType,
  relationId,
  tipoDocumental,
  initialItems = [],
  linkedIds,
  onChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [items, setItems] = useState(initialItems)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
    [items]
  )

  function sync(nextItems: AdjuntoItem[]) {
    setItems(nextItems)
    onChange?.(nextItems)
  }

  async function uploadFile(file: File) {
    setBusy(true)
    setError('')
    try {
      const formData = new FormData()
      formData.set('relation_type', relationType)
      formData.set('relation_id', relationId)
      formData.set('tipo_documental', tipoDocumental)
      formData.set('archivo', file)

      if (linkedIds?.documento_id) formData.set('documento_id', linkedIds.documento_id)
      if (linkedIds?.asiento_id) formData.set('asiento_id', linkedIds.asiento_id)
      if (linkedIds?.recibo_id) formData.set('recibo_id', linkedIds.recibo_id)
      if (linkedIds?.pago_proveedor_id) formData.set('pago_proveedor_id', linkedIds.pago_proveedor_id)

      const res = await fetch('/api/adjuntos', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo cargar el adjunto')

      sync([data, ...items])
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el adjunto')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este adjunto privado?')) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/adjuntos/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo eliminar el adjunto')
      sync(items.filter((item) => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el adjunto')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn(cardCls, 'p-4')}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-gray-800">Adjuntos privados</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void uploadFile(file)
            }}
          />
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5" /> Subir
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {sortedItems.length === 0 ? (
          <p className="text-sm text-gray-400">Todavía no hay archivos adjuntos.</p>
        ) : sortedItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{item.nombre_archivo}</p>
              <p className="text-xs text-gray-400">
                {item.tipo_documental} · {formatBytes(item.tamaño_bytes)} · {new Date(item.created_at).toLocaleString('es-CO')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => window.open(`/api/adjuntos/${item.id}/download`, '_blank')}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void handleDelete(item.id)} disabled={busy}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
