'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCOP } from '@/utils/cn'

interface FormaPago { id: string; descripcion: string }

interface Props {
  documentoId:  string
  totalFactura: number
  totalPagado:  number
  formasPago:   FormaPago[]
  onDone:       () => void
  onCancel:     () => void
}

const hoy = () => new Date().toISOString().slice(0, 10)

export function FormRecibo({ documentoId, totalFactura, totalPagado, formasPago, onDone, onCancel }: Props) {
  const pendiente = totalFactura - totalPagado
  const [forma_pago_id, setForma] = useState(formasPago[0]?.id ?? '')
  const [valor, setValor]         = useState(String(Math.round(pendiente)))
  const [fecha, setFecha]         = useState(hoy())
  const [obs, setObs]             = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor)
    if (!v || v <= 0) { setError('Ingresa un valor válido'); return }
    if (v > pendiente * 1.001) { setError(`El valor excede el saldo pendiente (${formatCOP(pendiente)})`); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/ventas/recibos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: documentoId, forma_pago_id, valor: v, fecha, observaciones: obs || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
        <div>
          <p className="text-gray-500">Total factura</p>
          <p className="font-bold text-gray-900">{formatCOP(totalFactura)}</p>
        </div>
        <div>
          <p className="text-gray-500">Saldo pendiente</p>
          <p className="font-bold text-blue-700">{formatCOP(pendiente)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Forma de pago</label>
        <select
          value={forma_pago_id}
          onChange={e => setForma(e.target.value)}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.descripcion}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Valor recibido</label>
        <input
          type="number"
          min="1"
          step="1"
          value={valor}
          onChange={e => setValor(e.target.value)}
          required
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          required
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Observaciones</label>
        <input
          type="text"
          value={obs}
          onChange={e => setObs(e.target.value)}
          placeholder="Opcional..."
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Registrando...' : 'Registrar pago'}
        </Button>
      </div>
    </form>
  )
}
