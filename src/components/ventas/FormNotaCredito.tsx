'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/utils/cn'
import { Search, Check } from 'lucide-react'

interface LineaFactura {
  id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  total_iva: number
  total: number
  descuento_porcentaje: number
  producto?: { codigo?: string } | null
}

interface Factura {
  id: string
  numero: number
  prefijo: string
  fecha: string
  total: number
  cliente?: { razon_social?: string } | null
  lineas: LineaFactura[]
}

export function FormNotaCredito({ facturaInicial }: { facturaInicial: Factura | null }) {
  const router = useRouter()
  const [buscando, setBuscando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [factura, setFactura] = useState<Factura | null>(facturaInicial)
  const [motivo, setMotivo] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscarFactura(e: React.FormEvent) {
    e.preventDefault()
    if (!busqueda.trim()) return
    setBuscando(true)
    setError(null)
    try {
      const res = await fetch(`/api/ventas/facturas?busqueda=${encodeURIComponent(busqueda)}&limit=5`)
      const data = await res.json()
      const facturas = data.facturas ?? []
      if (facturas.length === 0) { setError('No se encontraron facturas'); return }
      // Cargar la primera que coincida
      const r = await fetch(`/api/ventas/facturas/${facturas[0].id}`)
      const fdata = await r.json()
      setFactura(fdata)
      setSeleccionadas(new Set())
      setCantidades({})
    } catch {
      setError('Error al buscar la factura')
    } finally {
      setBuscando(false)
    }
  }

  function toggleLinea(linea_id: string, cantidad_max: number) {
    setSeleccionadas(prev => {
      const next = new Set(prev)
      if (next.has(linea_id)) {
        next.delete(linea_id)
      } else {
        next.add(linea_id)
        if (!cantidades[linea_id]) {
          setCantidades(c => ({ ...c, [linea_id]: cantidad_max }))
        }
      }
      return next
    })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!factura) return
    if (seleccionadas.size === 0) { setError('Selecciona al menos una línea para devolver'); return }
    if (!motivo.trim()) { setError('El motivo es requerido'); return }

    setGuardando(true)
    setError(null)
    try {
      const lineas = Array.from(seleccionadas).map(id => ({
        linea_id: id,
        cantidad: cantidades[id] ?? 1,
      }))

      const res = await fetch('/api/ventas/notas-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factura_id: factura.id, motivo: motivo.trim(), lineas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/ventas/notas-credito/${data.id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const totalDevolucion = Array.from(seleccionadas).reduce((sum, id) => {
    const linea = factura?.lineas.find(l => l.id === id)
    if (!linea) return sum
    const cant = cantidades[id] ?? linea.cantidad
    return sum + (linea.total / linea.cantidad) * cant
  }, 0)

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      {/* Buscar factura */}
      {!factura && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-5">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Buscar factura de origen</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="N° factura o nombre del cliente..."
              className="flex-1 h-9 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <button type="button" onClick={buscarFactura} disabled={buscando}
              className="h-9 px-4 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-700 disabled:opacity-50 flex items-center gap-2">
              <Search className="h-4 w-4" />
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      )}

      {factura && (
        <>
          {/* Info factura */}
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-600 font-medium">FACTURA ORIGEN</p>
              <p className="font-bold text-rose-800 font-mono">{factura.prefijo}{factura.numero}</p>
              <p className="text-sm text-rose-600">{(factura.cliente as any)?.razon_social ?? '—'} · {formatCOP(factura.total)}</p>
            </div>
            <button type="button" onClick={() => { setFactura(null); setSeleccionadas(new Set()) }}
              className="text-xs text-rose-600 hover:underline">
              Cambiar factura
            </button>
          </div>

          {/* Líneas a devolver */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
            <p className="px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
              Selecciona las líneas a devolver
            </p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-3 py-2 w-10" />
                  <th className="px-3 py-2 text-left text-gray-600">Producto</th>
                  <th className="px-3 py-2 text-right text-gray-600">Cant. original</th>
                  <th className="px-3 py-2 text-right text-gray-600">Cant. a devolver</th>
                  <th className="px-3 py-2 text-right text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {factura.lineas.map(l => {
                  const sel = seleccionadas.has(l.id)
                  const cant = cantidades[l.id] ?? l.cantidad
                  return (
                    <tr key={l.id} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${sel ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}
                      onClick={() => toggleLinea(l.id, l.cantidad)}>
                      <td className="px-3 py-3 text-center">
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center mx-auto ${sel ? 'bg-rose-600 border-rose-600' : 'border-gray-300'}`}>
                          {sel && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{l.descripcion}</p>
                        {l.producto?.codigo && <p className="text-xs text-gray-400">{l.producto.codigo}</p>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{l.cantidad}</td>
                      <td className="px-3 py-3 text-right" onClick={e => e.stopPropagation()}>
                        {sel && (
                          <input
                            type="number" min={1} max={l.cantidad} value={cant}
                            onChange={e => setCantidades(c => ({ ...c, [l.id]: Math.min(l.cantidad, Math.max(1, parseInt(e.target.value) || 1)) }))}
                            className="w-20 h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-rose-500"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300">
                        {sel ? formatCOP((l.total / l.cantidad) * cant) : formatCOP(l.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Motivo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Motivo de la devolución *</label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              required
              rows={3}
              placeholder="Ej: Producto defectuoso, error en pedido, etc."
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          {/* Total y botón */}
          {seleccionadas.size > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-600">Total a devolver</p>
                <p className="text-2xl font-bold font-mono text-rose-800">{formatCOP(totalDevolucion)}</p>
                <p className="text-xs text-rose-500">{seleccionadas.size} línea{seleccionadas.size !== 1 ? 's' : ''} seleccionada{seleccionadas.size !== 1 ? 's' : ''}</p>
              </div>
              <button type="submit" disabled={guardando}
                className="px-6 py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50">
                {guardando ? 'Creando...' : 'Crear nota crédito'}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </form>
  )
}
