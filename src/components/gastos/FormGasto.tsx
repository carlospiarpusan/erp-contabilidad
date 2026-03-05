'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatCOP } from '@/utils/cn'

interface Acreedor  { id: string; razon_social: string }
interface TipoGasto { id: string; descripcion: string; valor_estimado?: number }
interface FormaPago { id: string; descripcion: string }

interface Props {
  acreedores: Acreedor[]
  tiposGasto: TipoGasto[]
  formasPago: FormaPago[]
}

export function FormGasto({ acreedores, tiposGasto, formasPago }: Props) {
  const router = useRouter()

  const [tipo_gasto_id,  setTipoGastoId]  = useState(tiposGasto[0]?.id ?? '')
  const [forma_pago_id,  setFormaPagoId]  = useState(formasPago[0]?.id ?? '')
  const [acreedor_id,    setAcreedorId]   = useState('')
  const [descripcion,    setDescripcion]  = useState('')
  const [valor,          setValor]        = useState(0)
  const [fecha,          setFecha]        = useState(new Date().toISOString().split('T')[0])
  const [observaciones,  setObservaciones] = useState('')
  const [enviando,       setEnviando]     = useState(false)
  const [error,          setError]        = useState('')

  function handleTipoGasto(id: string) {
    setTipoGastoId(id)
    const tg = tiposGasto.find(t => t.id === id)
    if (tg?.valor_estimado) setValor(tg.valor_estimado)
    if (tg) setDescripcion(tg.descripcion)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!descripcion) return setError('Ingresa una descripción')
    if (valor <= 0)   return setError('El valor debe ser mayor a cero')
    setEnviando(true)
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_gasto_id, forma_pago_id,
          acreedor_id: acreedor_id || undefined,
          descripcion, valor, fecha, observaciones,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ?? 'Error al registrar el gasto')
      router.push('/gastos')
    } catch (e) {
      setError(String(e))
    } finally {
      setEnviando(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tipo de gasto *</label>
          <select value={tipo_gasto_id} onChange={e => handleTipoGasto(e.target.value)} className={inputCls} required>
            <option value="">— Seleccionar —</option>
            {tiposGasto.map(t => <option key={t.id} value={t.id}>{t.descripcion}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Forma de pago *</label>
          <select value={forma_pago_id} onChange={e => setFormaPagoId(e.target.value)} className={inputCls} required>
            {formasPago.map(f => <option key={f.id} value={f.id}>{f.descripcion}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Descripción del gasto *</label>
          <input value={descripcion} onChange={e => setDescripcion(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Valor *</label>
          <input
            type="number" min="0.01" step="0.01"
            value={valor} onChange={e => setValor(Number(e.target.value))}
            className={inputCls} required
          />
          {valor > 0 && (
            <p className="mt-1 text-xs text-purple-600 font-medium">{formatCOP(valor)}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Fecha *</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Acreedor (opcional)</label>
          <select value={acreedor_id} onChange={e => setAcreedorId(e.target.value)} className={inputCls}>
            <option value="">— Sin acreedor —</option>
            {acreedores.map(a => <option key={a.id} value={a.id}>{a.razon_social}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Observaciones</label>
          <input value={observaciones} onChange={e => setObservaciones(e.target.value)} className={inputCls} />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? 'Registrando…' : 'Registrar gasto'}
        </Button>
      </div>
    </form>
  )
}
