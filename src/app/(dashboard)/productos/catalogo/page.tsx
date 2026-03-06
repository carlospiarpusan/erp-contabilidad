export const dynamic = 'force-dynamic'

import { getProductos, getFamilias } from '@/lib/db/productos'
import { formatCOP } from '@/utils/cn'
import { LayoutGrid, Printer } from 'lucide-react'
import Link from 'next/link'
import { hasLowStock } from '@/lib/utils/stock'

interface PageProps {
  searchParams: Promise<{ q?: string; familia_id?: string }>
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  const sp         = await searchParams
  const busqueda   = sp.q ?? ''
  const familia_id = sp.familia_id

  const [{ productos, total }, familias] = await Promise.all([
    getProductos({ busqueda, familia_id, activo: true, limit: 200 }),
    getFamilias(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
            <LayoutGrid className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Catálogo de Productos</h1>
            <p className="text-sm text-gray-500">{total} producto{total !== 1 ? 's' : ''} activos</p>
          </div>
        </div>
        <Link href="/print/catalogo" target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
          <Printer className="h-4 w-4" /> Imprimir catálogo
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <div className="flex-1 min-w-48 flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Buscar</label>
          <input type="text" name="q" defaultValue={busqueda} placeholder="Código, descripción..."
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Familia</label>
          <select name="familia_id" defaultValue={familia_id ?? ''}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las familias</option>
            {familias.map(f => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/productos/catalogo" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* Cuadrícula */}
      {productos.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-12 text-center text-gray-400">
          No se encontraron productos
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {productos.map(p => {
            const stocks = (p as any).stock as { cantidad: number; cantidad_minima: number }[] ?? []
            const stockTotal = stocks.reduce((s, st) => s + (st.cantidad ?? 0), 0)
            const stockBajo  = hasLowStock(stocks)

            return (
              <Link key={p.id} href={`/productos/${p.id}`}
                className="group flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden hover:shadow-md transition-shadow">
                {/* Placeholder imagen */}
                <div className="h-36 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                  <span className="text-3xl font-bold text-blue-200 select-none">
                    {p.descripcion?.charAt(0)?.toUpperCase() ?? '?'}
                  </span>
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <p className="text-xs font-mono text-gray-400">{(p as any).codigo}</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {p.descripcion}
                  </p>
                  {(p as any).familia && (
                    <p className="text-xs text-gray-400">{((p as any).familia as { nombre?: string })?.nombre}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                    <span className="text-sm font-bold font-mono text-gray-900">{formatCOP((p as any).precio_venta ?? 0)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      stockBajo
                        ? 'bg-red-100 text-red-700'
                        : stockTotal > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500'
                    }`}>
                      {stockTotal > 0 ? `${stockTotal} uds` : 'Sin stock'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
