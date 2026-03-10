'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { AlertCircle } from 'lucide-react'

interface ClienteOption {
  id: string
  razon_social: string
  numero_documento?: string | null
}

const hoy = new Date().toISOString().slice(0, 10)
const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

export function FormServicio() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')
  const [form, setForm] = useState({
    cliente_id: '',
    tipo: 'reparacion',
    servicio: '',
    direccion: '',
    prioridad: 'normal',
    fecha_inicio: hoy,
    fecha_promesa: en7,
    observaciones: '',
  })

  const setField = (key: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.servicio.trim()) {
      setError('Describe el servicio requerido')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch('/api/ventas/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cliente_id: form.cliente_id || null,
          direccion: form.direccion || null,
          fecha_promesa: form.fecha_promesa || null,
          observaciones: form.observaciones || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push('/ventas/servicios')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Datos de la orden</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <RemoteLookup<ClienteOption>
              endpoint="/api/clientes"
              responseKey="clientes"
              value={form.cliente_id}
              initialLabel={clienteLabel}
              placeholder="Buscar cliente por nombre o documento"
              emptyMessage="Sin clientes para mostrar"
              queryParams={{ activo: true }}
              minChars={1}
              onSelect={(cliente) => {
                setForm((prev) => ({ ...prev, cliente_id: cliente.id }))
                setClienteLabel(cliente.numero_documento ? `${cliente.razon_social} (${cliente.numero_documento})` : cliente.razon_social)
              }}
              onClear={() => {
                setForm((prev) => ({ ...prev, cliente_id: '' }))
                setClienteLabel('')
              }}
              getOptionLabel={(cliente) => cliente.numero_documento ? `${cliente.razon_social} (${cliente.numero_documento})` : cliente.razon_social}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tipo de servicio</label>
            <select
              value={form.tipo}
              onChange={setField('tipo')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="reparacion">Reparacion</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="instalacion">Instalacion</option>
              <option value="garantia">Garantia</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Prioridad</label>
            <select
              value={form.prioridad}
              onChange={setField('prioridad')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha de ingreso</label>
            <input
              type="date"
              value={form.fecha_inicio}
              onChange={setField('fecha_inicio')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha promesa entrega</label>
            <input
              type="date"
              value={form.fecha_promesa}
              onChange={setField('fecha_promesa')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Direccion de servicio (si aplica)</label>
            <input
              type="text"
              value={form.direccion}
              onChange={setField('direccion')}
              placeholder="Calle 10 #5-20, Barrio Centro"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Descripcion del servicio *</label>
            <textarea
              value={form.servicio}
              onChange={setField('servicio')}
              rows={3}
              required
              placeholder="Describe que se necesita reparar o que servicio se requiere..."
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={setField('observaciones')}
              rows={2}
              placeholder="Notas adicionales, accesorios recibidos, estado del equipo..."
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={guardando} className="bg-violet-600 text-white hover:bg-violet-700">
          {guardando ? 'Guardando...' : 'Crear orden de servicio'}
        </Button>
      </div>
    </form>
  )
}
