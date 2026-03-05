'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatCOP } from '@/utils/cn'
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

interface Producto   { id: string; codigo: string; descripcion: string }
interface Cliente    { id: string; razon_social: string }
interface Grupo      { id: string; nombre: string }

interface Props {
  precios:    Precio[]
  productos:  Producto[]
  clientes:   Cliente[]
  grupos:     Grupo[]
}

const VACÍO: Omit<Precio, 'id'> = {
  nombre: '', tipo: '', precio: undefined, descuento_porcentaje: undefined,
  valida_desde: '', valida_hasta: '', producto_id: '', cliente_id: '', grupo_id: '',
}

export function GestorPrecios({ precios: init, productos, clientes, grupos }: Props) {
  const router = useRouter()
  const [precios, setPrecios] = useState(init)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState<Partial<Precio & { id?: string }>>(VACÍO)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Group by lista name
  const agrupados: Record<string, Precio[]> = {}
  for (const p of precios) {
    const key = p.nombre || 'Sin nombre'
    if (!agrupados[key]) agrupados[key] = []
    agrupados[key].push(p)
  }

  function abrir(p?: Precio) {
    setForm(p ? { ...p } : { ...VACÍO })
    setError('')
    setModal(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre?.trim() || !form.producto_id) {
      setError('Nombre y producto son requeridos')
      return
    }
    setSaving(true); setError('')
    try {
      const url    = form.id ? `/api/ventas/precios/${form.id}` : '/api/ventas/precios'
      const method = form.id ? 'PATCH' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:              form.nombre,
          tipo:                form.tipo   || null,
          producto_id:         form.producto_id,
          cliente_id:          form.cliente_id  || null,
          grupo_id:            form.grupo_id    || null,
          precio:              form.precio      ? Number(form.precio)             : null,
          descuento_porcentaje: form.descuento_porcentaje ? Number(form.descuento_porcentaje) : null,
          valida_desde:        form.valida_desde || null,
          valida_hasta:        form.valida_hasta || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      setModal(false)
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Eliminar este precio especial de la lista "${nombre}"?`)) return
    try {
      const res = await fetch(`/api/ventas/precios/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPrecios(prev => prev.filter(p => p.id !== id))
      }
    } catch { /* ignore */ }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">
          {precios.length} entrada{precios.length !== 1 ? 's' : ''} de precio especial
        </p>
        <Button size="sm" onClick={() => abrir()}>
          <Plus className="h-4 w-4 mr-1" /> Nueva entrada
        </Button>
      </div>

      {precios.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-10 text-center">
          <Tag className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay listas de precios configuradas</p>
          <p className="text-sm text-gray-400 mt-1">Crea precios especiales por producto, cliente o grupo.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => abrir()}>
            <Plus className="h-4 w-4 mr-1" /> Crear primera entrada
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(agrupados).map(([nombre, items]) => (
            <div key={nombre} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900">{nombre}</h3>
                  <p className="text-xs text-blue-600">{items.length} producto{items.length !== 1 ? 's' : ''}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => abrir({ ...VACÍO as Precio, nombre })}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
                </Button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Producto</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-600">Para</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Precio especial</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-600">Dcto%</th>
                    <th className="px-4 py-2 text-center font-semibold text-gray-600">Validez</th>
                    <th className="px-4 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(r => {
                    const prod     = r.producto
                    const clienteN = r.cliente?.razon_social
                    const grupoN   = r.grupo?.nombre
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2">
                          <p className="text-gray-900">{prod?.descripcion ?? '—'}</p>
                          {prod?.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-xs">{clienteN ?? grupoN ?? 'Todos'}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-blue-700">
                          {r.precio ? formatCOP(r.precio) : '—'}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {r.descuento_porcentaje ? `${r.descuento_porcentaje}%` : '—'}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">
                          {r.valida_desde ? `${r.valida_desde} — ${r.valida_hasta ?? '∞'}` : 'Siempre'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => abrir(r)}
                              className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => eliminar(r.id, r.nombre)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
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
              <Input label="Nombre de la lista *" value={form.nombre ?? ''} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Mayoristas, VIP, Temporada" required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Producto *</label>
              <select value={form.producto_id ?? ''} onChange={e => setForm(p => ({ ...p, producto_id: e.target.value }))}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Seleccionar...</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.descripcion} ({p.codigo})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Aplica para</label>
              <select value={form.cliente_id ?? form.grupo_id ?? ''}
                onChange={e => {
                  const val = e.target.value
                  const isGrupo = grupos.some(g => g.id === val)
                  setForm(p => ({ ...p, cliente_id: isGrupo ? '' : val || null, grupo_id: isGrupo ? val : null }))
                }}
                className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Todos los clientes</option>
                <optgroup label="Grupos">
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </optgroup>
                <optgroup label="Clientes específicos">
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </optgroup>
              </select>
            </div>
            <Input label="Precio especial" type="number" value={form.precio ?? ''} onChange={e => setForm(p => ({ ...p, precio: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="Dejar vacío si usa descuento" />
            <Input label="Descuento %" type="number" min="0" max="100" value={form.descuento_porcentaje ?? ''}
              onChange={e => setForm(p => ({ ...p, descuento_porcentaje: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="Ej: 10 para 10%" />
            <Input label="Válida desde" type="date" value={form.valida_desde ?? ''}
              onChange={e => setForm(p => ({ ...p, valida_desde: e.target.value || null }))} />
            <Input label="Válida hasta" type="date" value={form.valida_hasta ?? ''}
              onChange={e => setForm(p => ({ ...p, valida_hasta: e.target.value || null }))} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
