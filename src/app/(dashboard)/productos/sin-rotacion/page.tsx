export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Clock3, PackageSearch } from 'lucide-react'
import { formatCOP } from '@/utils/cn'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { getProductosSinRotacion } from '@/lib/db/productos'

const COLUMNAS = [
  { key: 'codigo', label: 'Código' },
  { key: 'descripcion', label: 'Producto' },
  { key: 'stock_actual', label: 'Stock actual', className: 'text-right' },
  { key: 'stock_minimo', label: 'Mínimo', className: 'text-right' },
  { key: 'dias_sin_venta', label: 'Días sin venta', className: 'text-right' },
  { key: 'valor_stock', label: 'Valor stock', className: 'text-right' },
]

interface PageProps {
  searchParams: Promise<{ dias?: string }>
}

export default async function ProductosSinRotacionPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const dias = Math.max(30, Math.min(Number(sp.dias ?? 90) || 90, 365))
  const filas = await getProductosSinRotacion({ days: dias, limit: 500 })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Clock3 className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Productos sin rotación</h1>
          <p className="text-sm text-gray-500">
            Artículos con stock disponible y sin ventas en los últimos {dias} días.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[60, 90, 180].map((opcion) => (
          <Link
            key={opcion}
            href={`/productos/sin-rotacion?dias=${opcion}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              opcion === dias
                ? 'border-violet-200 bg-violet-50 text-violet-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opcion} días
          </Link>
        ))}
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
          <PackageSearch className="mx-auto mb-3 h-12 w-12 text-violet-300" />
          <p className="text-lg font-medium text-gray-600">Sin alertas de rotación</p>
          <p className="text-sm text-gray-400">No hay productos con stock positivo y cero ventas en esta ventana.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-800">
            Esta alerta sigue el patrón de ERP de inventario lento: stock disponible + ausencia de ventas en una ventana operativa.
          </div>
          <p className="mb-4 text-sm text-gray-500">
            {filas.length} producto{filas.length !== 1 ? 's' : ''} con riesgo de capital inmovilizado.
          </p>

          <Tabla columnas={COLUMNAS}>
            {filas.map((fila) => (
              <FilaTabla key={fila.id}>
                <CeldaTabla>
                  <span className="font-mono text-xs text-gray-600">{fila.codigo}</span>
                </CeldaTabla>
                <CeldaTabla>
                  <Link href={`/productos/${fila.id}`} className="font-medium text-gray-900 hover:text-violet-600 transition-colors">
                    {fila.descripcion}
                  </Link>
                  {fila.familia?.nombre && (
                    <p className="text-xs text-gray-400">{fila.familia.nombre}</p>
                  )}
                </CeldaTabla>
                <CeldaTabla className="text-right font-mono text-gray-700">
                  {fila.stock_actual.toLocaleString('es-CO')}
                </CeldaTabla>
                <CeldaTabla className="text-right font-mono text-gray-500">
                  {fila.stock_minimo.toLocaleString('es-CO')}
                </CeldaTabla>
                <CeldaTabla className="text-right">
                  <span className="font-mono text-violet-700">
                    {fila.dias_sin_venta === null ? `+${dias}` : fila.dias_sin_venta.toLocaleString('es-CO')}
                  </span>
                </CeldaTabla>
                <CeldaTabla className="text-right font-medium text-gray-900">
                  {formatCOP(fila.valor_stock)}
                </CeldaTabla>
              </FilaTabla>
            ))}
          </Tabla>
        </>
      )}
    </div>
  )
}
