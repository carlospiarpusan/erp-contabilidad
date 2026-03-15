'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'
import { cardCls } from '@/utils/cn'

type CuentaPUCOption = {
  id: string
  codigo: string
  descripcion: string
}

type Linea = {
  cuenta_id: string
  descripcion: string
  debe: number
  haber: number
}

interface Props {
  cuentas: CuentaPUCOption[]
  initial?: {
    id?: string
    fecha: string
    concepto: string
    lineas: Linea[]
  }
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const LINEA_VACIA: Linea = {
  cuenta_id: '',
  descripcion: '',
  debe: 0,
  haber: 0,
}

export function FormAsientoManual({ cuentas, initial }: Props) {
  const router = useRouter()
  const [fecha, setFecha] = useState(initial?.fecha ?? new Date().toISOString().split('T')[0])
  const [concepto, setConcepto] = useState(initial?.concepto ?? '')
  const [lineas, setLineas] = useState<Linea[]>(
    initial?.lineas?.length ? initial.lineas : [{ ...LINEA_VACIA }, { ...LINEA_VACIA }]
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const totalDebe = useMemo(
    () => round2(lineas.reduce((s, l) => s + Number(l.debe || 0), 0)),
    [lineas]
  )
  const totalHaber = useMemo(
    () => round2(lineas.reduce((s, l) => s + Number(l.haber || 0), 0)),
    [lineas]
  )
  const balanceado = totalDebe > 0 && totalDebe === totalHaber

  function updateLinea(index: number, patch: Partial<Linea>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function eliminarLinea(index: number) {
    setLineas((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!fecha || !concepto.trim()) {
      setError('Fecha y concepto son requeridos')
      return
    }
    if (lineas.length < 2) {
      setError('Debe haber al menos 2 líneas')
      return
    }
    if (!balanceado) {
      setError('El asiento está descuadrado (débito y crédito deben ser iguales)')
      return
    }

    const payload = {
      fecha,
      concepto: concepto.trim(),
      lineas: lineas.map((l) => ({
        cuenta_id: l.cuenta_id,
        descripcion: l.descripcion?.trim() || '',
        debe: Number(l.debe || 0),
        haber: Number(l.haber || 0),
      })),
    }

    setGuardando(true)
    try {
      const res = await fetch(
        initial?.id ? `/api/contabilidad/asientos/${initial.id}` : '/api/contabilidad/asientos',
        {
          method: initial?.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo guardar el asiento')
      router.push('/contabilidad/asientos')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando el asiento')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      <div className={`${cardCls} p-5`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Concepto *</label>
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Descripción del asiento"
              required
            />
          </div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Líneas contables</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
          >
            <Plus className="mr-1 h-4 w-4" /> Agregar línea
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Cuenta</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-gray-600">Descripción</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Débito</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Crédito</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-gray-600">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineas.map((linea, index) => (
                <tr key={index}>
                  <td className="px-2 py-2">
                    <select
                      value={linea.cuenta_id}
                      onChange={(e) => updateLinea(index, { cuenta_id: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Seleccionar cuenta</option>
                      {cuentas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.descripcion}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={linea.descripcion}
                      onChange={(e) => updateLinea(index, { descripcion: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Detalle opcional"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={linea.debe}
                      onChange={(e) => updateLinea(index, { debe: Number(e.target.value), haber: 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={linea.haber}
                      onChange={(e) => updateLinea(index, { haber: Number(e.target.value), debe: 0 })}
                      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => eliminarLinea(index)}
                      disabled={lineas.length <= 2}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50/60">
                <td className="px-2 py-2 text-xs font-semibold text-gray-600" colSpan={2}>
                  Totales
                </td>
                <td className="px-2 py-2 text-right font-mono font-bold text-gray-800">{totalDebe.toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-mono font-bold text-gray-800">{totalHaber.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      balanceado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {balanceado ? 'Cuadrado' : 'Descuadrado'}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/contabilidad/asientos')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando || !balanceado}>
          {guardando ? 'Guardando...' : initial?.id ? 'Guardar cambios' : 'Crear asiento manual'}
        </Button>
      </div>
    </form>
  )
}
