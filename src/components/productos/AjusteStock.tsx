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
  onDone:   (result: {
    bodega_id: string
    stock_actual: number
    stock_final: number
    delta: number
  }) => void | Promise<void>
  onCancel: () => void
}

export function AjusteStock({ producto, bodegas, onDone, onCancel }: Props) {
  const defaultBodega = bodegas[0]?.id ?? ''
  const [bodega_id, setBodega] = useState(defaultBodega)
  const [tipo, setTipo]        = useState<string>('ajuste_inventario')
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas]      = useState('')
  const [saving, setSaving]    = useState(false)
  const [error, setError]      = useState('')
  const sinBodegas = bodegas.length === 0

  const stockActual = (producto.stock ?? [])
    .filter(s => s.bodega_id === bodega_id)
    .reduce((sum, s) => sum + s.cantidad, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sinBodegas) {
      setError('No se puede realizar el ajuste porque la empresa no tiene bodegas configuradas.')
      return
    }
    if (!bodega_id) {
      setError('Selecciona una bodega para aplicar el ajuste.')
      return
    }
    if (!cantidad || Number(cantidad) < 0 || (tipo !== 'ajuste_inventario' && Number(cantidad) <= 0)) {
      setError(tipo === 'ajuste_inventario' ? 'Ingresa una cantidad final válida' : 'Ingresa una cantidad válida')
      return
    }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/inventario/ajuste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: producto.id,
          bodega_id,
          tipo,
          cantidad: tipo === 'ajuste_inventario' ? undefined : Number(cantidad),
          stock_objetivo: tipo === 'ajuste_inventario' ? Number(cantidad) : undefined,
          notas,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'Error')

      const unidad = producto.unidad_medida ?? 'UND'
      const anterior = Number(body?.stock_actual ?? stockActual)
      const final = Number(body?.stock_final ?? body?.stock_objetivo ?? cantidad)
      const delta = Number(body?.delta ?? (final - anterior))

      if (body?.applied === false) {
        window.alert(`${producto.codigo}: sin cambios. Ya estaba en ${anterior.toLocaleString('es-CO')} ${unidad} en esta bodega.`)
      } else {
        window.alert(
          `${producto.codigo}: ajuste guardado. Pasó de ${anterior.toLocaleString('es-CO')} a ${final.toLocaleString('es-CO')} ${unidad} (${delta >= 0 ? '+' : ''}${delta.toLocaleString('es-CO')}).`
        )
      }

      await onDone({
        bodega_id,
        stock_actual: anterior,
        stock_final: final,
        delta,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {sinBodegas && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
          No se puede realizar el ajuste porque esta empresa no tiene bodegas configuradas.
        </div>
      )}

      <div className="rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{producto.descripcion}</p>
        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{producto.codigo}</p>
      </div>

      {/* Tipo de ajuste */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">Tipo de movimiento</label>
        <div className="flex flex-col gap-2">
          {TIPOS.map(t => (
            <label key={t.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${tipo === t.value ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-800/50'}`}>
              <input
                type="radio"
                name="tipo"
                value={t.value}
                checked={tipo === t.value}
                onChange={() => setTipo(t.value)}
                className="accent-blue-600"
              />
              <t.icon className={`h-4 w-4 ${t.color}`} />
              <span className="text-sm text-gray-700 dark:text-gray-200">{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Bodega */}
      {bodegas.length > 1 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Bodega</label>
          <select
            value={bodega_id}
            onChange={e => setBodega(e.target.value)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
          >
            {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-500">Stock actual en esta bodega: <strong className="text-gray-600 dark:text-gray-200">{stockActual}</strong> {producto.unidad_medida ?? 'UND'}</p>
        </div>
      )}

      {/* Cantidad */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {tipo === 'ajuste_inventario' ? 'Cantidad final en bodega' : 'Cantidad'}
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cantidad}
          onChange={e => setCantidad(e.target.value)}
          placeholder={tipo === 'ajuste_inventario' ? String(stockActual) : '0'}
          required
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-400"
        />
        {tipo === 'ajuste_inventario' && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Stock actual: <strong className="text-gray-600 dark:text-gray-200">{stockActual}</strong>. Se ajustará al valor final que ingreses.
          </p>
        )}
      </div>

      {/* Notas */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Motivo del ajuste..."
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-blue-400"
        />
      </div>

      {error && <p className="text-sm text-red-500 dark:text-red-300">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" disabled={saving || sinBodegas || !bodega_id}>{saving ? 'Guardando...' : tipo === 'ajuste_inventario' ? 'Guardar ajuste' : 'Registrar movimiento'}</Button>
      </div>
    </form>
  )
}
