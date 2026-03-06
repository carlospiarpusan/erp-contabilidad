export const dynamic = 'force-dynamic'

import { getProductos } from '@/lib/db/productos'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { AlertTriangle, Package } from 'lucide-react'
import { formatCOP } from '@/utils/cn'
import Link from 'next/link'
import { isLowStock } from '@/lib/utils/stock'

const COLUMNAS = [
  { key: 'codigo',      label: 'Código' },
  { key: 'descripcion', label: 'Producto' },
  { key: 'bodega',      label: 'Bodega' },
  { key: 'actual',      label: 'Stock actual', className: 'text-center' },
  { key: 'minimo',      label: 'Mínimo',        className: 'text-center' },
  { key: 'pventa',      label: 'Precio venta',  className: 'text-right' },
]

export default async function StockBajoPage() {
  const { productos } = await getProductos({ stock_bajo: true, limit: 200 })

  type StockFila = {
    id: string
    cantidad: number
    cantidad_minima: number
    bodega?: { nombre?: string } | null
  }

  const filas: Array<{ producto: typeof productos[number]; stock: StockFila }> = []
  for (const p of productos) {
    const stocks = p.stock ?? []
    if (stocks.length === 0) {
      filas.push({
        producto: p,
        stock: { id: `sin-stock-${p.id}`, cantidad: 0, cantidad_minima: 0, bodega: { nombre: 'Sin bodega' } },
      })
      continue
    }
    for (const s of stocks) {
      if (!isLowStock(s)) continue
      filas.push({
        producto: p,
        stock: {
          id: s.id,
          cantidad: s.cantidad,
          cantidad_minima: s.cantidad_minima,
          bodega: (s.bodega as { nombre?: string } | null) ?? null,
        },
      })
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Stock bajo mínimo</h1>
          <p className="text-sm text-gray-500">Productos que requieren reabastecimiento</p>
        </div>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <Package className="mx-auto h-12 w-12 text-green-300 mb-3" />
          <p className="text-gray-600 font-medium text-lg">Todo en orden</p>
          <p className="text-sm text-gray-400">No hay productos con stock crítico o bajo mínimo</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {filas.length} producto{filas.length !== 1 ? 's' : ''} en stock crítico o bajo mínimo
          </p>
          <Tabla columnas={COLUMNAS}>
            {filas.map(({ producto: p, stock: s }) => (
              <FilaTabla key={`${p.id}-${s.id}`}>
                <CeldaTabla>
                  <span className="font-mono text-xs text-gray-600">{p.codigo}</span>
                </CeldaTabla>
                <CeldaTabla>
                  <Link href={`/productos/${p.id}`} className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                    {p.descripcion}
                  </Link>
                  {(p.familia as { nombre?: string } | null)?.nombre && (
                    <p className="text-xs text-gray-400">{(p.familia as { nombre: string }).nombre}</p>
                  )}
                </CeldaTabla>
                <CeldaTabla>
                  <span className="text-sm text-gray-600">{(s.bodega as { nombre?: string } | null)?.nombre ?? '—'}</span>
                </CeldaTabla>
                <CeldaTabla className="text-center">
                  <span className="flex items-center justify-center gap-1 font-mono font-medium text-orange-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {s.cantidad.toLocaleString('es-CO')}
                  </span>
                </CeldaTabla>
                <CeldaTabla className="text-center">
                  <span className="font-mono text-gray-500">{s.cantidad_minima.toLocaleString('es-CO')}</span>
                </CeldaTabla>
                <CeldaTabla className="text-right font-medium text-gray-900">
                  {formatCOP(p.precio_venta)}
                </CeldaTabla>
              </FilaTabla>
            ))}
          </Tabla>
        </>
      )}
    </div>
  )
}
