'use client'

import { useMemo, useState } from 'react'
import { FileCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardCls, cn } from '@/utils/cn'
import { AdjuntosPrivados, type AdjuntoItem } from '@/components/shared/AdjuntosPrivados'

interface DocumentoSoporte {
  id?: string
  requerido: boolean
  estado: 'no_requerido' | 'pendiente' | 'adjunto' | 'validado' | 'rechazado'
  proveedor_tecnologico?: string | null
  numero_externo?: string | null
  fecha_emision?: string | null
  archivo_adjunto_id?: string | null
  observaciones?: string | null
  proveedor?: {
    razon_social?: string | null
    numero_documento?: string | null
    obligado_a_facturar?: boolean | null
  } | null
}

interface Props {
  documentoId: string
  requerido: boolean
  estadoDocumento?: string | null
  initialSoporte: DocumentoSoporte | null
  initialAdjuntos?: AdjuntoItem[]
}

export function DocumentoSoporteCard({ documentoId, requerido, estadoDocumento, initialSoporte, initialAdjuntos = [] }: Props) {
  const [soporte, setSoporte] = useState<DocumentoSoporte>(() => initialSoporte ?? {
    requerido,
    estado: requerido ? 'pendiente' : 'no_requerido',
    proveedor_tecnologico: '',
    numero_externo: '',
    fecha_emision: '',
    archivo_adjunto_id: null,
    observaciones: '',
  })
  const [adjuntos, setAdjuntos] = useState<AdjuntoItem[]>(initialAdjuntos)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const selectedAdjunto = useMemo(
    () => soporte.archivo_adjunto_id ?? adjuntos[0]?.id ?? null,
    [adjuntos, soporte.archivo_adjunto_id]
  )

  function updateField<K extends keyof DocumentoSoporte>(key: K, value: DocumentoSoporte[K]) {
    setSoporte((prev) => ({ ...prev, [key]: value }))
  }

  function showMessage(type: 'ok' | 'error', text: string) {
    setMessage({ type, text })
    window.setTimeout(() => setMessage(null), 4000)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/documento-soporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_id: documentoId,
          requerido,
          estado: requerido ? soporte.estado : 'no_requerido',
          proveedor_tecnologico: soporte.proveedor_tecnologico || null,
          numero_externo: soporte.numero_externo || null,
          fecha_emision: soporte.fecha_emision || null,
          archivo_adjunto_id: selectedAdjunto,
          observaciones: soporte.observaciones || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar el documento soporte')
      setSoporte((prev) => ({ ...prev, ...data }))
      showMessage('ok', 'Documento soporte actualizado.')
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'No se pudo guardar el documento soporte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cn(cardCls, 'p-4')}>
        <div className="mb-3 flex items-center gap-2">
          {requerido ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : <FileCheck className="h-4 w-4 text-emerald-600" />}
          <h3 className="text-sm font-semibold text-gray-800">Documento soporte externo</h3>
        </div>

        {message && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${
            message.type === 'ok'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border border-red-200 bg-red-50 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <div className={`mb-4 rounded-xl px-3 py-3 text-sm ${
          requerido ? 'border border-amber-200 bg-amber-50 text-amber-900' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          {requerido
            ? `Esta compra exige documento soporte. Estado actual: ${estadoDocumento ?? soporte.estado}.`
            : 'Esta compra no exige documento soporte según la configuración actual.'}
          {soporte.proveedor && (
            <span className="mt-1 block text-xs opacity-80">
              Proveedor: {soporte.proveedor.razon_social ?? '—'} ·
              {soporte.proveedor.obligado_a_facturar !== false ? ' obligado a facturar' : ' no obligado a facturar'}
            </span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Estado</label>
            <select
              value={requerido ? soporte.estado : 'no_requerido'}
              onChange={(e) => updateField('estado', e.target.value as DocumentoSoporte['estado'])}
              disabled={!requerido}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="pendiente">Pendiente</option>
              <option value="adjunto">Adjunto</option>
              <option value="validado">Validado</option>
              <option value="rechazado">Rechazado</option>
              <option value="no_requerido">No requerido</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Proveedor tecnológico</label>
            <input
              value={soporte.proveedor_tecnologico ?? ''}
              onChange={(e) => updateField('proveedor_tecnologico', e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              placeholder="DIAN / proveedor externo"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Número externo</label>
            <input
              value={soporte.numero_externo ?? ''}
              onChange={(e) => updateField('numero_externo', e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              placeholder="DS-2026-001"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Fecha de emisión</label>
            <input
              type="date"
              value={soporte.fecha_emision ?? ''}
              onChange={(e) => updateField('fecha_emision', e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Adjunto asociado</label>
            <select
              value={selectedAdjunto ?? ''}
              onChange={(e) => updateField('archivo_adjunto_id', e.target.value || null)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Selecciona un adjunto</option>
              {adjuntos.map((adjunto) => (
                <option key={adjunto.id} value={adjunto.id}>
                  {adjunto.nombre_archivo}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Observaciones</label>
            <textarea
              rows={3}
              value={soporte.observaciones ?? ''}
              onChange={(e) => updateField('observaciones', e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Notas del soporte, rechazo o validación."
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar soporte'}
          </Button>
        </div>
      </div>

      <AdjuntosPrivados
        relationType="documento"
        relationId={documentoId}
        tipoDocumental="documento_soporte"
        initialItems={initialAdjuntos}
        linkedIds={{ documento_id: documentoId }}
        onChange={(items) => setAdjuntos(items)}
      />
    </div>
  )
}
