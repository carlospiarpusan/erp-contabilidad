'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/utils/cn'
import { Plus, Trash2 } from 'lucide-react'

interface Impuesto {
  id: string
  nombre: string
  porcentaje: number
}

interface LineaForm {
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_id: string
}

interface Cliente {
  id: string
  razon_social: string
  numero_documento: string
}

export function FormNotaDebito({ impuestos }: { impuestos: Impuesto[] }) {
  const router = useRouter()
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [facturaBusqueda, setFacturaBusqueda] = useState('')
  const [facturaId, setFacturaId] = useState<string | null>(null)
  const [facturaLabel, setFacturaLabel] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lineas, setLineas] = useState<LineaForm[]>([
    { descripcion: '', cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, impuesto_id: '' },
  ])

  async function buscarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (!busquedaCliente.trim()) return
    setBuscandoCliente(true)
    setError(null)
    try {
      const res = await fetch(`/api/clientes?q=${encodeURIComponent(busquedaCliente)}&limit=5`)
      const data = await res.json()
      const clientes = data.clientes ?? []
      if (clientes.length === 0) { setError('No se encontró el cliente'); return }
      setCliente(clientes[0])
    } catch {
      setError('Error al buscar el cliente')
    } finally {
      setBuscandoCliente(false)
    }
  }

  async function buscarFactura(e: React.FormEvent) {
    e.preventDefault()
    if (!facturaBusqueda.trim()) return
    try {
      const res = await fetch(`/api/ventas/facturas?busqueda=${encodeURIComponent(facturaBusqueda)}&limit=5`)
      const data = await res.json()
      const facturas = data.facturas ?? []
      if (facturas.length === 0) { setError('No se encontró la factura'); return }
      const f = facturas[0]
      setFacturaId(f.id)
      setFacturaLabel(`${f.prefijo ?? ''}${f.numero}`)
      if (!cliente && f.cliente_id) {
        const cr = await fetch(`/api/clientes/${f.cliente_id}`)
        if (cr.ok) {
          const cd = await cr.json()
          setCliente({ id: cd.id, razon_social: cd.razon_social, numero_documento: cd.numero_documento })
        }
      }
    } catch {
      setError('Error al buscar la factura')
    }
  }

  function agregarLinea() {
    setLineas(prev => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, descuento_porcentaje: 0, impuesto_id: '' }])
  }

  function eliminarLinea(i: number) {
    setLineas(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateLinea(i: number, field: keyof LineaForm, value: string | number) {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function calcLinea(l: LineaForm) {
    const sub   = l.precio_unitario * l.cantidad * (1 - l.descuento_porcentaje / 100)
    const imp   = impuestos.find(x => x.id === l.impuesto_id)
    const iva   = sub * ((imp?.porcentaje ?? 0) / 100)
    return { sub, iva, total: sub + iva }
  }

  const totales = lineas.reduce((acc, l) => {
    const c = calcLinea(l)
    return { sub: acc.sub + c.sub, iva: acc.iva + c.iva, total: acc.total + c.total }
  }, { sub: 0, iva: 0, total: 0 })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente) { setError('Selecciona un cliente'); return }
    if (!motivo.trim()) { setError('El motivo es requerido'); return }
    const lineasValidas = lineas.filter(l => l.descripcion.trim() && l.precio_unitario > 0)
    if (lineasValidas.length === 0) { setError('Agrega al menos una línea válida'); return }

    setGuardando(true)
    setError(null)
    try {
      const res = await fetch('/api/ventas/notas-debito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          factura_id: facturaId,
          motivo: motivo.trim(),
          lineas: lineasValidas.map(l => ({
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento_porcentaje: l.descuento_porcentaje,
            impuesto_id: l.impuesto_id || null,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/ventas/notas-debito/${data.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">

      {/* Cliente */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Cliente *</p>
        {cliente ? (
          <div className="flex items-center justify-between rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 px-4 py-3">
            <div>
              <p className="font-semibold text-amber-800">{cliente.razon_social}</p>
              <p className="text-xs text-amber-600">{cliente.numero_documento}</p>
            </div>
            <button type="button" onClick={() => setCliente(null)} className="text-xs text-amber-600 hover:underline">Cambiar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={busquedaCliente} onChange={e => setBusquedaCliente(e.target.value)}
              placeholder="Nombre o NIT del cliente..."
              className="flex-1 h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <button type="button" onClick={buscarCliente} disabled={buscandoCliente}
              className="h-9 px-4 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50">
              {buscandoCliente ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        )}
      </div>

      {/* Factura origen (opcional) */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Factura de referencia <span className="text-gray-400 font-normal">(opcional)</span></p>
        {facturaId ? (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 px-4 py-2">
            <p className="font-mono text-gray-700 dark:text-gray-300">{facturaLabel}</p>
            <button type="button" onClick={() => { setFacturaId(null); setFacturaLabel('') }} className="text-xs text-gray-500 hover:underline">Quitar</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={facturaBusqueda} onChange={e => setFacturaBusqueda(e.target.value)}
              placeholder="N° de factura..."
              className="flex-1 h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <button type="button" onClick={buscarFactura}
              className="h-9 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">Buscar</button>
          </div>
        )}
      </div>

      {/* Motivo */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Motivo *</label>
        <textarea value={motivo} onChange={e => setMotivo(e.target.value)} required rows={2}
          placeholder="Ej: Ajuste de precio, recargo por mora, corrección de factura..."
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" />
      </div>

      {/* Líneas */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Líneas de cargo</p>
          <button type="button" onClick={agregarLinea}
            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
            <Plus className="h-3.5 w-3.5" /> Agregar línea
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs">
            <tr>
              <th className="px-3 py-2 text-left text-gray-600">Descripción</th>
              <th className="px-3 py-2 text-right text-gray-600 w-20">Cant.</th>
              <th className="px-3 py-2 text-right text-gray-600 w-28">P. Unit.</th>
              <th className="px-3 py-2 text-right text-gray-600 w-20">Dcto%</th>
              <th className="px-3 py-2 text-left text-gray-600 w-28">IVA</th>
              <th className="px-3 py-2 text-right text-gray-600 w-28">Total</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lineas.map((l, i) => {
              const c = calcLinea(l)
              return (
                <tr key={i}>
                  <td className="px-2 py-2">
                    <input type="text" value={l.descripcion}
                      onChange={e => updateLinea(i, 'descripcion', e.target.value)}
                      placeholder="Descripción del cargo..."
                      className="w-full h-8 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={1} value={l.cantidad}
                      onChange={e => updateLinea(i, 'cantidad', parseFloat(e.target.value) || 1)}
                      className="w-full h-8 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} step={100} value={l.precio_unitario}
                      onChange={e => updateLinea(i, 'precio_unitario', parseFloat(e.target.value) || 0)}
                      className="w-full h-8 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={0} max={100} value={l.descuento_porcentaje}
                      onChange={e => updateLinea(i, 'descuento_porcentaje', parseFloat(e.target.value) || 0)}
                      className="w-full h-8 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs text-right focus:outline-none focus:ring-1 focus:ring-amber-500" />
                  </td>
                  <td className="px-2 py-2">
                    <select value={l.impuesto_id} onChange={e => updateLinea(i, 'impuesto_id', e.target.value)}
                      className="w-full h-8 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                      <option value="">Sin IVA</option>
                      {impuestos.map(imp => (
                        <option key={imp.id} value={imp.id}>{imp.nombre} ({imp.porcentaje}%)</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs text-gray-700 dark:text-gray-300">
                    {formatCOP(c.total)}
                  </td>
                  <td className="px-2 py-2">
                    {lineas.length > 1 && (
                      <button type="button" onClick={() => eliminarLinea(i)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totales + guardar */}
      <div className="flex items-end justify-between gap-4">
        <div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right space-y-0.5 text-sm">
            <p className="text-gray-500">Subtotal: <span className="font-mono">{formatCOP(totales.sub)}</span></p>
            {totales.iva > 0 && <p className="text-gray-500">IVA: <span className="font-mono">{formatCOP(totales.iva)}</span></p>}
            <p className="font-bold text-amber-700 text-base">Total: <span className="font-mono">{formatCOP(totales.total)}</span></p>
          </div>
          <button type="submit" disabled={guardando}
            className="px-6 py-2.5 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-50">
            {guardando ? 'Creando...' : 'Crear nota débito'}
          </button>
        </div>
      </div>
    </form>
  )
}
