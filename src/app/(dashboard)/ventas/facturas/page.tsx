export const dynamic = 'force-dynamic'

import { getFacturas, getEstadisticasVentas } from '@/lib/db/ventas'
import { ListaFacturas } from '@/components/ventas/ListaFacturas'
import { TrendingUp, Clock, CheckCircle, Calendar } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface PageProps {
  searchParams: Promise<{ q?: string; estado?: string; offset?: string }>
}

export default async function FacturasPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const offset = parseInt(sp.offset ?? '0')
  const limit  = 50

  const [{ facturas, total }, stats] = await Promise.all([
    getFacturas({
      busqueda: sp.q ?? undefined,
      estado:   sp.estado ?? undefined,
      offset,
      limit,
    }),
    getEstadisticasVentas(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Facturas de venta</h2>
          <p className="text-sm text-gray-500">Gestiona tus ventas y cobros</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500">Total facturas</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3 text-orange-500" />Por cobrar</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{formatCOP(stats.pendiente)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" />Cobrado</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCOP(stats.pagada)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3 text-blue-500" />Este mes</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{formatCOP(stats.este_mes)}</p>
        </div>
      </div>

      <ListaFacturas
        facturas={facturas as unknown as Parameters<typeof ListaFacturas>[0]["facturas"]}
        total={total}
        busqueda={sp.q ?? ''}
        estadoFiltro={sp.estado ?? ''}
        offset={offset}
        limit={limit}
      />
    </div>
  )
}
