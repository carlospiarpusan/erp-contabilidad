'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { RemoteLookup } from '@/components/ui/remote-lookup'
import { formatCOP , cardCls , cn } from '@/utils/cn'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'

interface Precio {
  id: string
  nombre: string
  tipo?: string | null
  precio?: number | null
  descuento_porcentaje?: number | null
  valida_desde?: string | null
  valida_hasta?: string | null
  producto_id: string
  cliente_id?: string | null
  grupo_id?: string | null
  producto?: { codigo?: string; descripcion?: string } | null
  cliente?: { razon_social?: string } | null
  grupo?: { nombre?: string } | null
}

interface ProductoOption {
  id: string
  codigo: string
  descripcion: string
}

interface ClienteOption {
  id: string
  razon_social: string
  numero_documento?: string | null
}

interface Grupo {
  id: string
  nombre: string
}

interface Props {
  precios: Precio[]
  grupos: Grupo[]
}

type ScopeMode = 'todos' | 'grupo' | 'cliente'

const VACIO: Omit<Precio, 'id'> = {
  nombre: '',
  tipo: '',
  precio: undefined,
  descuento_porcentaje: undefined,
  valida_desde: '',
  valida_hasta: '',
  producto_id: '',
  cliente_id: '',
  grupo_id: '',
}

function formatProductoLabel(producto: { codigo?: string; descripcion?: string }) {
  return [producto.codigo, producto.descripcion].filter(Boolean).join(' · ')
}

export function GestorPrecios({ precios: init, grupos }: Props) {
  const router = useRouter()
  const [precios, setPrecios] = useState(init)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Precio & { id?: string }>>(VACIO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('todos')
  const [productoLabel, setProductoLabel] = useState('')
  const [clienteLabel, setClienteLabel] = useState('')

  const agrupados: Record<string, Precio[]> = {}
  for (const precio of precios) {
    const key = precio.nombre || 'Sin nombre'
    if (!agrupados[key]) agrupados[key] = []
    agrupados[key].push(precio)
  }

  function abrir(precio?: Precio) {
    if (precio) {
      setForm({ ...precio, cliente_id: precio.cliente_id ?? '', grupo_id: precio.grupo_id ?? '' })
      setProductoLabel(formatProductoLabel(precio.producto ?? {}))
      setClienteLabel(precio.cliente?.razon_social ?? '')
      setScopeMode(precio.cliente_id ? 'cliente' : precio.grupo_id ? 'grupo' : 'todos')
    } else {
      setForm({ ...VACIO })
      setProductoLabel('')
      setClienteLabel('')
      setScopeMode('todos')
    }

    setError('')
    setModal(true)
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (!form.nombre?.trim() || !form.producto_id) {
      setError('Nombre y producto son requeridos')
      return
    }

    setSaving(true)
    setError('')

    try {
      const url = form.id ? `/api/ventas/precios/${form.id}` : '/api/ventas/precios'
      const method = form.id ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          tipo: form.tipo || null,
          producto_id: form.producto_id,
          cliente_id: scopeMode === 'cliente' ? form.cliente_id || null : null,
          grupo_id: scopeMode === 'grupo' ? form.grupo_id || null : null,
          precio: form.precio ? Number(form.precio) : null,
          descuento_porcentaje: form.descuento_porcentaje ? Number(form.descuento_porcentaje) : null,
          valida_desde: form.valida_desde || null,
          valida_hasta: form.valida_hasta || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error')
        return
      }

      setModal(false)
      router.refresh()
    } catch {
      setError('Error de conexion')
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`Eliminar este precio especial de la lista "${nombre}"?`)) return
    try {
      const res = await fetch(`/api/ventas/precios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPrecios((prev) => prev.filter((precio) => precio.id !== id))
      }
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {precios.length} entrada{precios.length !== 1 ? 's' : ''} de precio especial
        </p>
        <Button size="sm" onClick={() => abrir()}>
          <Plus className="mr-1 h-4 w-4" /> Nueva entrada
        </Button>
      </div>

      {precios.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
          <Tag className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="font-medium text-gray-500">No hay listas de precios configuradas</p>
          <p className="mt-1 text-sm text-gray-400">Crea precios especiales por producto, cliente o grupo.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => abrir()}>
            <Plus className="mr-1 h-4 w-4" /> Crear primera entrada
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(agrupados).map(([nombre, items]) => (
            <div key={nombre} className={cn('overflow-hidden', cardCls)}>
              <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50 px-5 py-4">
                <div>
                  <h3 className="font-semibold text-blue-900">{nombre}</h3>
                  <p className="text-xs text-blue-600">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrir({ ...(VACIO as Precio), nombre })}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Producto</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Para</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Precio especial</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Dcto%</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">Validez</th>
                    <th className="w-16 px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((registro) => {
                    const clienteNombre = registro.cliente?.razon_social
                    const grupoNombre = registro.grupo?.nombre
                    return (
                      <tr key={registro.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2">
                          <p className="text-gray-900">{registro.producto?.descripcion ?? '—'}</p>
                          {registro.producto?.codigo && (
                            <p className="font-mono text-xs text-gray-400">{registro.producto.codigo}</p>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{clienteNombre ?? grupoNombre ?? 'Todos'}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">
                          {registro.precio ? formatCOP(registro.precio) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {registro.descuento_porcentaje ? `${registro.descuento_porcentaje}%` : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">
                          {registro.valida_desde ? `${registro.valida_desde} - ${registro.valida_hasta ?? '∞'}` : 'Siempre'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => abrir(registro)}
                              className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminar(registro.id, registro.nombre)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} titulo={form.id ? 'Editar precio especial' : 'Nuevo precio especial'} size="lg">
        <form onSubmit={guardar} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label="Nombre de la lista *"
                value={form.nombre ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, nombre: event.target.value }))}
                placeholder="Ej: Mayoristas, VIP, Temporada"
                required
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Producto *</label>
              <RemoteLookup<ProductoOption>
                endpoint="/api/productos"
                responseKey="productos"
                value={form.producto_id ?? ''}
                initialLabel={productoLabel}
                placeholder="Buscar producto por codigo o descripcion"
                emptyMessage="Sin productos para mostrar"
                queryParams={{ activo: true }}
                minChars={1}
                onSelect={(producto) => {
                  setForm((prev) => ({ ...prev, producto_id: producto.id }))
                  setProductoLabel(formatProductoLabel(producto))
                }}
                onClear={() => {
                  setForm((prev) => ({ ...prev, producto_id: '' }))
                  setProductoLabel('')
                }}
                getOptionLabel={(producto) => formatProductoLabel(producto)}
              />
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Aplica para</label>
              <select
                value={scopeMode}
                onChange={(event) => {
                  const next = event.target.value as ScopeMode
                  setScopeMode(next)
                  if (next !== 'cliente') {
                    setForm((prev) => ({ ...prev, cliente_id: '' }))
                    setClienteLabel('')
                  }
                  if (next !== 'grupo') {
                    setForm((prev) => ({ ...prev, grupo_id: '' }))
                  }
                }}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todos">Todos los clientes</option>
                <option value="grupo">Grupo de clientes</option>
                <option value="cliente">Cliente especifico</option>
              </select>
            </div>

            {scopeMode === 'grupo' && (
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Grupo</label>
                <select
                  value={form.grupo_id ?? ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, grupo_id: event.target.value }))}
                  className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {grupos.map((grupo) => (
                    <option key={grupo.id} value={grupo.id}>{grupo.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {scopeMode === 'cliente' && (
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Cliente</label>
                <RemoteLookup<ClienteOption>
                  endpoint="/api/clientes"
                  responseKey="clientes"
                  value={form.cliente_id ?? ''}
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
            )}

            <Input
              label="Precio especial"
              type="number"
              value={form.precio ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, precio: event.target.value ? Number(event.target.value) : undefined }))}
              placeholder="Dejar vacio si usa descuento"
            />
            <Input
              label="Descuento %"
              type="number"
              min="0"
              max="100"
              value={form.descuento_porcentaje ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, descuento_porcentaje: event.target.value ? Number(event.target.value) : undefined }))}
              placeholder="Ej: 10 para 10%"
            />
            <Input
              label="Valida desde"
              type="date"
              value={form.valida_desde ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, valida_desde: event.target.value || null }))}
            />
            <Input
              label="Valida hasta"
              type="date"
              value={form.valida_hasta ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, valida_hasta: event.target.value || null }))}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
