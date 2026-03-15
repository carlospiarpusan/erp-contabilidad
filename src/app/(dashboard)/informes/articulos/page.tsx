export const dynamic = 'force-dynamic'

import { getInformeArticulos } from '@/lib/db/informes'
import { getFamilias } from '@/lib/db/productos'
import { formatCOP , cardCls , cn } from '@/utils/cn'
import { Package } from 'lucide-react'
import Link from 'next/link'
import { isLowStockValue } from '@/lib/utils/stock'

interface PageProps {
  searchParams: Promise<{ familia_id?: string; con_stock?: string }>
}

export default async function InformeArticulosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const conStock = sp.con_stock === '1'

  const [{ productos, totales }, familias] = await Promise.all([
    getInformeArticulos({ familia_id: sp.familia_id, con_stock: conStock }),
    getFamilias(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Package className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inventario Valorado</h1>
          <p className="text-sm text-gray-500">{productos.length} artículo{productos.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/api/export/inventario" download
           className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">
          Exportar CSV
        </a>
      </div>

      {/* Filtros */}
      <form className={cn('flex flex-wrap gap-3', cardCls, 'p-4')}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Familia</label>
          <select name="familia_id" defaultValue={sp.familia_id ?? ''}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas las familias</option>
            {familias.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Stock</label>
          <select name="con_stock" defaultValue={conStock ? '1' : ''}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="1">Solo con stock</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/informes/articulos" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      {/* KPIs totales */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Unidades en stock',  val: totales.unidades.toLocaleString('es-CO'), mono: false },
          { label: 'Valor a costo',      val: formatCOP(totales.valor_costo), mono: true, color: 'text-orange-700' },
          { label: 'Valor a precio venta', val: formatCOP(totales.valor_venta), mono: true, color: 'text-blue-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.mono ? 'font-mono' : ''} ${k.color ?? 'text-gray-900 dark:text-gray-100'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className={cn(cardCls, 'overflow-x-auto')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Familia</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Stock</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">P. Costo</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">P. Venta</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor costo</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Valor venta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productos.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Sin artículos</td></tr>
            ) : productos.map(p => {
              const fam = p.familia as { nombre?: string; descripcion?: string } | null
              const valorCosto = (p.stock_actual ?? 0) * (p.precio_compra ?? 0)
              const valorVenta = (p.stock_actual ?? 0) * (p.precio_venta ?? 0)
              const stockBajo  = isLowStockValue(p.stock_actual ?? 0, p.stock_minimo ?? 0)
              return (
                <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${stockBajo ? 'bg-orange-50' : ''}`}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.codigo}</td>
                  <td className="px-4 py-2 text-gray-900">
                    <Link href={`/productos/${p.id}`} className="hover:text-blue-600">{p.descripcion}</Link>
                    {stockBajo && <span className="ml-2 text-xs text-orange-600 font-medium">Stock bajo</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{fam?.descripcion ?? fam?.nombre ?? '—'}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${stockBajo ? 'text-orange-700' : 'text-gray-900 dark:text-gray-100'}`}>{p.stock_actual ?? 0}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-600">{formatCOP(p.precio_compra ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900">{formatCOP(p.precio_venta ?? 0)}</td>
                  <td className="px-4 py-2 text-right font-mono text-orange-700">{formatCOP(valorCosto)}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-700">{formatCOP(valorVenta)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
