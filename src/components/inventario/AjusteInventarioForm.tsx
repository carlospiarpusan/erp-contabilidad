'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, CheckCircle, Plus, Minus } from 'lucide-react'

interface ProductoSimple { id: string; codigo: string; descripcion: string }
interface Bodega { id: string; nombre: string }

interface Props {
  productos: ProductoSimple[]
  bodegas: Bodega[]
}

interface FilaAjuste {
  producto_id: string
  codigo: string
  descripcion: string
  cantidad_fisica: string
  notas: string
}

export function AjusteInventarioForm({ productos, bodegas }: Props) {
  const router = useRouter()
  const [bodegaId, setBodegaId] = useState(bodegas[0]?.id ?? '')
  const [busqueda, setBusqueda] = useState('')
  const [filas, setFilas] = useState<FilaAjuste[]>([])
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  const productosFiltrados = busqueda
    ? productos.filter(p =>
        (p.descripcion ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.codigo ?? '').toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 10)
    : []

  const agregarProducto = (p: ProductoSimple) => {
    if (filas.some(f => f.producto_id === p.id)) return
    setFilas(prev => [...prev, {
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      cantidad_fisica: '',
      notas: '',
    }])
    setBusqueda('')
  }

  const actualizarFila = (idx: number, campo: keyof FilaAjuste, valor: string) => {
    setFilas(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [campo]: valor }
      return next
    })
  }

  const eliminarFila = (idx: number) => setFilas(prev => prev.filter((_, i) => i !== idx))

  const handleGuardar = async () => {
    const filasValidas = filas.filter(f => f.cantidad_fisica !== '' && !isNaN(parseFloat(f.cantidad_fisica)))
    if (!filasValidas.length || !bodegaId) return
    setGuardando(true)
    let ok = 0, err = 0
    try {
      for (const f of filasValidas) {
        const cantidad = parseFloat(f.cantidad_fisica)
        const res = await fetch('/api/inventario/ajuste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: f.producto_id,
            bodega_id: bodegaId,
            tipo: 'ajuste_inventario',
            cantidad: Math.abs(cantidad),
            notas: f.notas || `Ajuste manual${cantidad < 0 ? ' (descuento)' : ' (incremento)'}`,
          }),
        })
        if (res.ok) ok++ ; else err++
      }
      setResultado(`${ok} ajuste(s) aplicado(s)${err > 0 ? `, ${err} error(es)` : ''}`)
      setFilas([])
    } finally {
      setGuardando(false)
    }
  }

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-800 dark:text-white">{resultado}</p>
        <div className="flex gap-3">
          <button onClick={() => router.push('/productos')} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700">
            Ver productos
          </button>
          <button onClick={() => setResultado(null)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            Nuevo ajuste
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bodega */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Bodega</label>
        <select
          value={bodegaId}
          onChange={e => setBodegaId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700"
        >
          {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
        </select>
      </div>

      {/* Buscar producto */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Agregar producto</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre..."
            className="w-full rounded-lg border border-gray-200 pl-9 pr-4 py-2 text-sm dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {productosFiltrados.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
              {productosFiltrados.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarProducto(p)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span className="font-mono text-xs text-gray-400 mr-2">{p.codigo}</span>
                  {p.descripcion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de ajuste */}
      {filas.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Producto</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Cantidad ajuste</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filas.map((f, idx) => (
                <tr key={f.producto_id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{f.descripcion}</p>
                    <p className="text-xs text-gray-400 font-mono">{f.codigo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => actualizarFila(idx, 'cantidad_fisica', String((parseFloat(f.cantidad_fisica) || 0) - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        value={f.cantidad_fisica}
                        onChange={e => actualizarFila(idx, 'cantidad_fisica', e.target.value)}
                        placeholder="0"
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center dark:bg-gray-800 dark:border-gray-700 focus:outline-none"
                      />
                      <button onClick={() => actualizarFila(idx, 'cantidad_fisica', String((parseFloat(f.cantidad_fisica) || 0) + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-0.5">
                      {f.cantidad_fisica !== '' && parseFloat(f.cantidad_fisica) !== 0
                        ? parseFloat(f.cantidad_fisica) > 0 ? 'Entrada' : 'Salida'
                        : 'Sin cambio'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={f.notas}
                      onChange={e => actualizarFila(idx, 'notas', e.target.value)}
                      placeholder="Motivo (opcional)"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:bg-gray-800 dark:border-gray-700 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => eliminarFila(idx)} className="text-gray-300 hover:text-red-500">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filas.length > 0 && (
        <div className="flex justify-end gap-3">
          <button onClick={() => setFilas([])} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700">
            Limpiar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {guardando ? 'Aplicando...' : `Aplicar ajuste (${filas.filter(f => f.cantidad_fisica !== '' && !isNaN(parseFloat(f.cantidad_fisica))).length} productos)`}
          </button>
        </div>
      )}
    </div>
  )
}
