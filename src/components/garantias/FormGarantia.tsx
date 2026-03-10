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

interface ProductoOption {
  id: string
  descripcion: string
  codigo?: string | null
}

export function FormGarantia() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')
  const [productoLabel, setProductoLabel] = useState('')
  const [form, setForm] = useState({
    cliente_id: '',
    producto_id: '',
    numero_serie: '',
    numero_rma: '',
    fecha_venta: '',
    prioridad: 'normal',
    observaciones: '',
  })

  const setField = (key: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.observaciones.trim()) {
      setError('Describe el motivo de la garantia')
      return
    }

    setGuardando(true)
    setError('')

    try {
      const res = await fetch('/api/ventas/garantias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cliente_id: form.cliente_id || null,
          producto_id: form.producto_id || null,
          numero_serie: form.numero_serie || null,
          numero_rma: form.numero_rma || null,
          fecha_venta: form.fecha_venta || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')
      router.push('/ventas/garantias')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Error')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Informacion de la garantia</h3>
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

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Producto</label>
            <RemoteLookup<ProductoOption>
              endpoint="/api/productos"
              responseKey="productos"
              value={form.producto_id}
              initialLabel={productoLabel}
              placeholder="Buscar producto por codigo o descripcion"
              emptyMessage="Sin productos para mostrar"
              queryParams={{ activo: true }}
              minChars={1}
              onSelect={(producto) => {
                setForm((prev) => ({ ...prev, producto_id: producto.id }))
                setProductoLabel(producto.codigo ? `${producto.codigo} · ${producto.descripcion}` : producto.descripcion)
              }}
              onClear={() => {
                setForm((prev) => ({ ...prev, producto_id: '' }))
                setProductoLabel('')
              }}
              getOptionLabel={(producto) => producto.codigo ? `${producto.codigo} · ${producto.descripcion}` : producto.descripcion}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Numero de serie</label>
            <input
              type="text"
              value={form.numero_serie}
              onChange={setField('numero_serie')}
              placeholder="SN-12345"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Numero RMA</label>
            <input
              type="text"
              value={form.numero_rma}
              onChange={setField('numero_rma')}
              placeholder="RMA-001"
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Fecha de venta original</label>
            <input
              type="date"
              value={form.fecha_venta}
              onChange={setField('fecha_venta')}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Prioridad</label>
            <select
              value={form.prioridad}
              onChange={setField('prioridad')}
              className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Descripcion del problema *</label>
            <textarea
              value={form.observaciones}
              onChange={setField('observaciones')}
              rows={3}
              required
              placeholder="Describe el defecto o motivo de la garantia..."
              className="resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <Button type="submit" disabled={guardando} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {guardando ? 'Guardando...' : 'Registrar garantia'}
        </Button>
      </div>
    </form>
  )
}
