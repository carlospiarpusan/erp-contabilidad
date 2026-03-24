'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardCls, cn } from '@/utils/cn'

interface Ejercicio {
  id: string
  año: number
  descripcion?: string | null
}

interface Periodo {
  id: string
  ejercicio_id: string
  año: number
  mes: number
  fecha_inicio: string
  fecha_fin: string
  estado: 'abierto' | 'cerrado' | 'reabierto'
  motivo?: string | null
  cerrado_at?: string | null
  reabierto_at?: string | null
}

interface Props {
  ejercicios: Ejercicio[]
  periodos: Periodo[]
}

export function GestionPeriodosContables({ ejercicios, periodos }: Props) {
  const router = useRouter()
  const [selectedEjercicio, setSelectedEjercicio] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const visibles = useMemo(() => (
    selectedEjercicio
      ? periodos.filter((periodo) => periodo.ejercicio_id === selectedEjercicio)
      : periodos
  ), [periodos, selectedEjercicio])

  async function updatePeriodo(id: string, estado: Periodo['estado']) {
    const motivo = window.prompt(
      estado === 'cerrado'
        ? 'Motivo del cierre del periodo:'
        : 'Motivo de la reapertura del periodo:'
    )

    if ((estado === 'cerrado' || estado === 'reabierto') && !motivo?.trim()) return

    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`/api/contabilidad/periodos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, motivo }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo actualizar el periodo')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el periodo')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(cardCls, 'p-4')}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Ejercicio</label>
            <select
              value={selectedEjercicio}
              onChange={(e) => setSelectedEjercicio(e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Todos los ejercicios</option>
              {ejercicios.map((ejercicio) => (
                <option key={ejercicio.id} value={ejercicio.id}>
                  {ejercicio.año} · {ejercicio.descripcion ?? `Ejercicio ${ejercicio.año}`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">
            Los periodos se generan por ejercicio y bloquean escrituras en contabilidad, compras, tesorería e inventario valorizado.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className={cn(cardCls, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Periodo</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Rango</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Motivo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">No hay periodos disponibles.</td>
              </tr>
            ) : visibles.map((periodo) => (
              <tr key={periodo.id}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {periodo.año}-{String(periodo.mes).padStart(2, '0')}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {periodo.fecha_inicio} → {periodo.fecha_fin}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                    periodo.estado === 'cerrado'
                      ? 'bg-red-50 text-red-700'
                      : periodo.estado === 'reabierto'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {periodo.estado}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{periodo.motivo ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {periodo.estado !== 'cerrado' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePeriodo(periodo.id, 'cerrado')}
                        disabled={busyId === periodo.id}
                      >
                        <Lock className="h-3.5 w-3.5" /> Cerrar
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => updatePeriodo(periodo.id, 'reabierto')}
                        disabled={busyId === periodo.id}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
