'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cardCls, formatCOP, formatFecha } from '@/utils/cn'
import { Plus, Scale, CheckCircle2, AlertTriangle } from 'lucide-react'

interface CuentaBancaria {
  id: string; nombre: string; banco: string; saldo_actual: number
}
interface Conciliacion {
  id: string; cuenta_bancaria_id: string
  fecha_inicio: string; fecha_fin: string
  saldo_extracto: number; saldo_libros: number; diferencia: number
  estado: string; observaciones?: string | null
  cuenta?: { id: string; nombre: string; banco: string } | null
}

interface Props {
  cuentas: CuentaBancaria[]
  conciliaciones: Conciliacion[]
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'

export function ConciliacionBancaria({ cuentas, conciliaciones: inicial }: Props) {
  const router = useRouter()
  const [conciliaciones, setConciliaciones] = useState(inicial)
  const [modalNueva, setModalNueva] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    cuenta_bancaria_id: cuentas[0]?.id ?? '',
    fecha_inicio: '', fecha_fin: '', saldo_extracto: '', observaciones: '',
  })

  async function crearConciliacion() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/conciliaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error')
      setConciliaciones(prev => [body, ...prev])
      setModalNueva(false)
      setForm({ cuenta_bancaria_id: cuentas[0]?.id ?? '', fecha_inicio: '', fecha_fin: '', saldo_extracto: '', observaciones: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function marcarConciliada(conc: Conciliacion) {
    try {
      const res = await fetch('/api/tesoreria/conciliaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conc.id, estado: 'conciliada' }),
      })
      if (!res.ok) throw new Error('Error')
      const updated = await res.json()
      setConciliaciones(prev => prev.map(c => c.id === conc.id ? updated : c))
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-xs font-medium underline">Cerrar</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{conciliaciones.length} conciliaci{conciliaciones.length !== 1 ? 'ones' : 'ón'}</p>
        <Button size="sm" onClick={() => setModalNueva(true)} disabled={cuentas.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Nueva conciliación
        </Button>
      </div>

      {cuentas.length === 0 && (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-gray-500">Primero crea una cuenta bancaria en la sección Cuentas Bancarias</p>
        </div>
      )}

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Cuenta</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Período</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Saldo extracto</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Saldo libros</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Diferencia</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-medium text-gray-500">Estado</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-medium text-gray-500">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {conciliaciones.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin conciliaciones</td></tr>
            ) : conciliaciones.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{c.cuenta?.nombre ?? '—'}</span>
                  <span className="block text-xs text-gray-400">{c.cuenta?.banco}</span>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                  {formatFecha(c.fecha_inicio)} — {formatFecha(c.fecha_fin)}
                </td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{formatCOP(c.saldo_extracto)}</td>
                <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{formatCOP(c.saldo_libros)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 font-semibold ${c.diferencia === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {c.diferencia === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {formatCOP(c.diferencia)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={c.estado === 'conciliada' ? 'success' : 'warning'}>
                    {c.estado === 'conciliada' ? 'Conciliada' : 'Borrador'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  {c.estado === 'borrador' && (
                    <Button size="sm" variant="outline" onClick={() => marcarConciliada(c)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Conciliar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nueva conciliación */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)} titulo="Nueva conciliación bancaria" size="md">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Cuenta bancaria *</label>
            <select value={form.cuenta_bancaria_id} onChange={e => setForm(f => ({ ...f, cuenta_bancaria_id: e.target.value }))} className={inputCls}>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha inicio *</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin *</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Saldo según extracto bancario *</label>
            <input type="number" step="0.01" value={form.saldo_extracto} onChange={e => setForm(f => ({ ...f, saldo_extracto: e.target.value }))} className={inputCls} placeholder="0.00" />
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inputCls} rows={2} placeholder="Notas..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalNueva(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearConciliacion} disabled={guardando || !form.fecha_inicio || !form.fecha_fin || !form.saldo_extracto}>
              {guardando ? 'Guardando...' : 'Crear conciliación'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
