'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface Cliente { id: string; razon_social: string }
interface Props   { clientes: Cliente[] }

const hoy = new Date().toISOString().slice(0, 10)
const en7  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

export function FormServicio({ clientes }: Props) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const [form, setForm] = useState({
    cliente_id:    '',
    tipo:          'reparacion',
    servicio:      '',
    direccion:     '',
    prioridad:     'normal',
    fecha_inicio:  hoy,
    fecha_promesa: en7,
    observaciones: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.servicio.trim()) { setError('Describe el servicio requerido'); return }
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/ventas/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push('/ventas/servicios')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-2xl">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Datos de la orden</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <select value={form.cliente_id} onChange={set('cliente_id')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">— Seleccionar cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo de servicio</label>
            <select value={form.tipo} onChange={set('tipo')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="reparacion">Reparación</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="instalacion">Instalación</option>
              <option value="garantia">Garantía</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Prioridad</label>
            <select value={form.prioridad} onChange={set('prioridad')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha de ingreso</label>
            <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha promesa entrega</label>
            <input type="date" value={form.fecha_promesa} onChange={set('fecha_promesa')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Dirección de servicio (si aplica)</label>
            <input type="text" value={form.direccion} onChange={set('direccion')}
              placeholder="Calle 10 #5-20, Barrio Centro"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Descripción del servicio *</label>
            <textarea value={form.servicio} onChange={set('servicio')} rows={3} required
              placeholder="Describe qué se necesita reparar o qué servicio se requiere..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea value={form.observaciones} onChange={set('observaciones')} rows={2}
              placeholder="Notas adicionales, accesorios recibidos, estado del equipo..."
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" />
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
          className="bg-violet-600 hover:bg-violet-700 text-white">
          {guardando ? 'Guardando…' : 'Crear orden de servicio'}
        </Button>
      </div>
    </form>
  )
}
