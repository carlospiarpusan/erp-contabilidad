'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface Cliente { id: string; razon_social: string }
interface Producto { id: string; descripcion: string; codigo?: string }

interface Props { clientes: Cliente[]; productos: Producto[] }



export function FormGarantia({ clientes, productos }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    cliente_id: '',
    producto_id: '',
    numero_serie: '',
    numero_rma: '',
    fecha_venta: '',
    prioridad: 'normal',
    observaciones: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.observaciones.trim()) { setError('Describe el motivo de la garantía'); return }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/ventas/garantias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push('/ventas/garantias')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Información de la garantía</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <select value={form.cliente_id} onChange={set('cliente_id')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Producto</label>
            <select value={form.producto_id} onChange={set('producto_id')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Seleccionar producto —</option>
              {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Número de serie</label>
            <input type="text" value={form.numero_serie} onChange={set('numero_serie')}
              placeholder="SN-12345"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Número RMA</label>
            <input type="text" value={form.numero_rma} onChange={set('numero_rma')}
              placeholder="RMA-001"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha de venta original</label>
            <input type="date" value={form.fecha_venta} onChange={set('fecha_venta')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Descripción del problema *</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={3} required
              placeholder="Describe el defecto o motivo de la garantía..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={guardando}
          className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {guardando ? 'Guardando…' : 'Registrar garantía'}
        </Button>
      </div>
    </form>
  )
}
