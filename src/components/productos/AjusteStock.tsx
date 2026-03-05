'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Bodega, Producto } from '@/types'
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react'

const TIPOS = [
  { value: 'ajuste_positivo',  label: 'Entrada manual',      icon: ArrowUpCircle,   color: 'text-green-600' },
  { value: 'ajuste_negativo',  label: 'Salida manual',       icon: ArrowDownCircle, color: 'text-red-600' },
  { value: 'ajuste_inventario', label: 'Ajuste inventario', icon: RefreshCw,       color: 'text-blue-600' },
]

interface Props {
  producto: Producto
  bodegas:  Bodega[]
  onDone:   () => void
  onCancel: () => void
}

export function AjusteStock({ producto, bodegas, onDone, onCancel }: Props) {
  const defaultBodega = bodegas[0]?.id ?? ''
  const [bodega_id, setBodega] = useState(defaultBodega)
  const [tipo, setTipo]        = useState<string>(TIPOS[0].value)
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas]      = useState('')
  const [saving, setSaving]    = useState(false)
  const [error, setError]      = useState('')

  const stockActual = (producto.stock ?? [])
    .filter(s => s.bodega_id === bodega_id)
    .reduce((sum, s) => sum + s.cantidad, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cantidad || Number(cantidad) <= 0) { setError('Ingresa una cantidad válida'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/inventario/ajuste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto_id: producto.id, bodega_id, tipo, cantidad: Number(cantidad), notas }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? 'Error') }
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-lg bg-gray-50 px-4 py-3">
        <p className="text-sm font-medium text-gray-700">{producto.descripcion}</p>
        <p className="text-xs text-gray-500 font-mono">{producto.codigo}</p>
      </div>

      {/* Tipo de ajuste */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo de movimiento</label>
        <div className="flex flex-col gap-2">
          {TIPOS.map(t => (
            <label key={t.value} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${tipo === t.value ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 dark:bg-gray-950'}`}>
              <input
                type="radio"
                name="tipo"
                value={t.value}
                checked={tipo === t.value}
                onChange={() => setTipo(t.value)}
                className="accent-blue-600"
              />
              <t.icon className={`h-4 w-4 ${t.color}`} />
              <span className="text-sm text-gray-700">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Bodega */}
      {bodegas.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Bodega</label>
          <select
            value={bodega_id}
            onChange={e => setBodega(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <p className="text-xs text-gray-400">Stock actual en esta bodega: <strong>{stockActual}</strong> {producto.unidad_medida ?? 'UND'}</p>
        </div>
      )}

      {/* Cantidad */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Cantidad</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={cantidad}
          onChange={e => setCantidad(e.target.value)}
          placeholder="0"
          required
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Motivo del ajuste..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</Button>
      </div>
    </form>
  )
}
