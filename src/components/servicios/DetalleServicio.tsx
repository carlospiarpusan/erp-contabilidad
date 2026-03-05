'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wrench, ChevronRight, CheckCircle, XCircle, Package } from 'lucide-react'
import { formatFecha } from '@/utils/cn'

interface Servicio {
  id: string; numero: number; tipo: string; estado: string; prioridad: string
  servicio: string; direccion?: string | null; diagnostico?: string | null
  solucion?: string | null; observaciones?: string | null
  fecha_inicio?: string | null; fecha_promesa?: string | null; fecha_cierre?: string | null
  created_at: string
  cliente?: { id?: string; razon_social?: string; numero_documento?: string; email?: string; telefono?: string } | null
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  recibida:    'outline',
  diagnostico: 'warning',
  en_proceso:  'info',
  listo:       'default',
  entregado:   'success',
  cancelado:   'danger',
}

const FLUJO = ['recibida', 'diagnostico', 'en_proceso', 'listo', 'entregado']

const PRIORIDAD_COLOR: Record<string, string> = {
  baja:   'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  alta:   'bg-orange-100 text-orange-700',
  urgente:'bg-red-100 text-red-700',
}

interface Props { servicio: Servicio }

export function DetalleServicio({ servicio }: Props) {
  const router = useRouter()
  const [accionando, setAccionando] = useState(false)
  const [guardando, setGuardando]   = useState(false)
  const [notas, setNotas]           = useState({
    diagnostico:  servicio.diagnostico  ?? '',
    solucion:     servicio.solucion     ?? '',
    observaciones:servicio.observaciones ?? '',
  })

  const activo = !['entregado', 'cancelado'].includes(servicio.estado)
  const idxActual = FLUJO.indexOf(servicio.estado)
  const siguiente = FLUJO[idxActual + 1] ?? null

  async function avanzar() {
    if (!siguiente) return
    setAccionando(true)
    try {
      const res = await fetch(`/api/ventas/servicios/${servicio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: siguiente }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.refresh()
    } catch (e: any) { alert(e.message) }
    finally { setAccionando(false) }
  }

  async function cancelar() {
    if (!confirm('¿Cancelar esta orden de servicio?')) return
    setAccionando(true)
    try {
      await fetch(`/api/ventas/servicios/${servicio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' }),
      })
      router.refresh()
    } catch (e: any) { alert(e.message) }
    finally { setAccionando(false) }
  }

  async function guardarNotas() {
    setGuardando(true)
    try {
      await fetch(`/api/ventas/servicios/${servicio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notas),
      })
      router.refresh()
    } catch {}
    finally { setGuardando(false) }
  }

  const LABELS: Record<string, string> = {
    recibida: 'Recibida', diagnostico: 'Diagnóstico', en_proceso: 'En proceso',
    listo: 'Listo p/entrega', entregado: 'Entregado',
  }
  const NEXT_LABEL: Record<string, string> = {
    recibida: 'Iniciar diagnóstico', diagnostico: 'Iniciar reparación',
    en_proceso: 'Marcar listo', listo: 'Marcar entregado',
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
              <Wrench className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">Orden #{servicio.numero}</h2>
                <Badge variant={BADGE_ESTADO[servicio.estado] ?? 'outline'}>{servicio.estado.replace('_', ' ')}</Badge>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLOR[servicio.prioridad] ?? 'bg-gray-100 text-gray-600'}`}>
                  {servicio.prioridad}
                </span>
                <span className="text-xs text-gray-400 capitalize">{servicio.tipo}</span>
              </div>
              <p className="text-sm text-gray-500">Ingreso: {servicio.fecha_inicio ? formatFecha(servicio.fecha_inicio) : '—'}</p>
              {servicio.fecha_promesa && <p className="text-xs text-gray-400">Promesa: {formatFecha(servicio.fecha_promesa)}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {activo && siguiente && (
              <Button size="sm" variant="success" onClick={avanzar} disabled={accionando}>
                <ChevronRight className="h-4 w-4 mr-1" /> {NEXT_LABEL[servicio.estado] ?? 'Avanzar'}
              </Button>
            )}
            {activo && (
              <Button size="sm" variant="outline" onClick={cancelar} disabled={accionando}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Progreso */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto">
          {FLUJO.map((paso, i) => {
            const completado = i <= idxActual
            const actual     = paso === servicio.estado
            return (
              <div key={paso} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  actual      ? 'bg-violet-600 text-white' :
                  completado  ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {completado && !actual && <CheckCircle className="h-3 w-3" />}
                  {LABELS[paso]}
                </div>
                {i < FLUJO.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300 shrink-0" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cliente */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Cliente</p>
          <p className="font-semibold text-gray-900">{servicio.cliente?.razon_social ?? '—'}</p>
          {servicio.cliente?.numero_documento && <p className="text-sm text-gray-500 mt-0.5">{servicio.cliente.numero_documento}</p>}
          {servicio.cliente?.email    && <p className="text-sm text-gray-500">{servicio.cliente.email}</p>}
          {servicio.cliente?.telefono && <p className="text-sm text-gray-500">{servicio.cliente.telefono}</p>}
        </div>

        {/* Descripción del servicio */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Servicio solicitado</p>
          <p className="text-gray-800">{servicio.servicio}</p>
          {servicio.direccion && (
            <p className="text-sm text-gray-500 mt-2">Dirección: {servicio.direccion}</p>
          )}
          {servicio.fecha_cierre && (
            <p className="text-sm text-green-600 mt-2">Entregado: {formatFecha(servicio.fecha_cierre)}</p>
          )}
        </div>
      </div>

      {/* Notas técnicas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Notas técnicas</p>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Diagnóstico</label>
            <textarea value={notas.diagnostico} onChange={e => setNotas(p => ({ ...p, diagnostico: e.target.value }))}
              rows={2} disabled={!activo} placeholder="Diagnóstico del técnico..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Solución aplicada</label>
            <textarea value={notas.solucion} onChange={e => setNotas(p => ({ ...p, solucion: e.target.value }))}
              rows={2} disabled={!activo} placeholder="Descripción de la solución..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Observaciones adicionales</label>
            <textarea value={notas.observaciones} onChange={e => setNotas(p => ({ ...p, observaciones: e.target.value }))}
              rows={2} disabled={!activo} placeholder="Piezas reemplazadas, accesorios entregados..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          {activo && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={guardarNotas} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar notas'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
