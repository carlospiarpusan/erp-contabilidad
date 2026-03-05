'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShieldCheck, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { formatFecha } from '@/utils/cn'

interface Garantia {
  id: string; numero: number; estado: string; prioridad: string
  numero_serie?: string | null; numero_rma?: string | null
  fecha_venta?: string | null; observaciones?: string | null; created_at: string
  cliente?: { id?: string; razon_social?: string; numero_documento?: string; email?: string; telefono?: string } | null
  producto?: { id?: string; codigo?: string; descripcion?: string } | null
  documento?: { id?: string; prefijo?: string; numero?: number } | null
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  pendiente:  'warning',
  en_proceso: 'info',
  resuelta:   'success',
  rechazada:  'danger',
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja:   'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  alta:   'bg-orange-100 text-orange-700',
  urgente:'bg-red-100 text-red-700',
}

interface Props { garantia: Garantia }

export function DetalleGarantia({ garantia }: Props) {
  const router = useRouter()
  const [accionando, setAccionando] = useState(false)
  const [notas, setNotas]           = useState(garantia.observaciones ?? '')
  const [rma, setRma]               = useState(garantia.numero_rma ?? '')
  const [guardandoNotas, setGuardandoNotas] = useState(false)

  async function cambiarEstado(estado: string) {
    setAccionando(true)
    try {
      const res = await fetch(`/api/ventas/garantias/${garantia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (e: any) { alert(e.message) }
    finally { setAccionando(false) }
  }

  async function guardarNotas() {
    setGuardandoNotas(true)
    try {
      await fetch(`/api/ventas/garantias/${garantia.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones: notas, numero_rma: rma || null }),
      })
      router.refresh()
    } catch {}
    finally { setGuardandoNotas(false) }
  }

  const activo = !['resuelta', 'rechazada'].includes(garantia.estado)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">Garantía #{garantia.numero}</h2>
                <Badge variant={BADGE_ESTADO[garantia.estado] ?? 'outline'}>{garantia.estado}</Badge>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLOR[garantia.prioridad] ?? 'bg-gray-100 text-gray-600'}`}>
                  {garantia.prioridad}
                </span>
              </div>
              <p className="text-sm text-gray-500">Registrada: {formatFecha(garantia.created_at)}</p>
            </div>
          </div>
          {activo && (
            <div className="flex flex-wrap gap-2">
              {garantia.estado === 'pendiente' && (
                <Button size="sm" onClick={() => cambiarEstado('en_proceso')} disabled={accionando}>
                  <Clock className="h-4 w-4 mr-1" /> Tomar caso
                </Button>
              )}
              {garantia.estado === 'en_proceso' && (
                <Button size="sm" variant="success" onClick={() => cambiarEstado('resuelta')} disabled={accionando}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Marcar resuelta
                </Button>
              )}
              {activo && (
                <Button size="sm" variant="outline" onClick={() => cambiarEstado('rechazada')} disabled={accionando}>
                  <XCircle className="h-4 w-4 mr-1" /> Rechazar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Cliente</p>
          <p className="font-semibold text-gray-900">{garantia.cliente?.razon_social ?? '—'}</p>
          {garantia.cliente?.numero_documento && <p className="text-sm text-gray-500 mt-0.5">{garantia.cliente.numero_documento}</p>}
          {garantia.cliente?.email    && <p className="text-sm text-gray-500">{garantia.cliente.email}</p>}
          {garantia.cliente?.telefono && <p className="text-sm text-gray-500">{garantia.cliente.telefono}</p>}
          {garantia.documento?.id && (
            <p className="text-sm text-gray-400 mt-2">
              Factura origen:{' '}
              <a href={`/ventas/facturas/${garantia.documento.id}`} className="text-blue-600 hover:underline font-mono">
                {garantia.documento.prefijo}{garantia.documento.numero}
              </a>
            </p>
          )}
        </div>

        {/* Producto */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Producto en garantía</p>
          {garantia.producto ? (
            <>
              <p className="font-semibold text-gray-900">{garantia.producto.descripcion}</p>
              {garantia.producto.codigo && <p className="text-xs text-gray-400 font-mono mt-0.5">{garantia.producto.codigo}</p>}
            </>
          ) : <p className="text-gray-400">—</p>}
          {garantia.numero_serie && (
            <p className="text-sm text-gray-500 mt-2">N° Serie: <span className="font-mono">{garantia.numero_serie}</span></p>
          )}
          {garantia.fecha_venta && (
            <p className="text-sm text-gray-500">Fecha venta: {formatFecha(garantia.fecha_venta)}</p>
          )}
        </div>
      </div>

      {/* Notas y gestión */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Descripción y seguimiento</p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">N° RMA</label>
            <input type="text" value={rma} onChange={e => setRma(e.target.value)}
              placeholder="RMA-001"
              disabled={!activo}
              className="h-9 w-48 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Descripción / Resolución</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4}
              disabled={!activo}
              placeholder="Describe el defecto, acciones tomadas, solución aplicada..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          {activo && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={guardarNotas} disabled={guardandoNotas}>
                {guardandoNotas ? 'Guardando…' : 'Guardar notas'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
