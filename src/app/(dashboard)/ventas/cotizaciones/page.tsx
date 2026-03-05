export const dynamic = 'force-dynamic'

import { getCotizaciones, getEstadisticasCotizaciones } from '@/lib/db/cotizaciones'
import { ListaCotizaciones } from '@/components/cotizaciones/ListaCotizaciones'
import { FileText } from 'lucide-react'
import { formatCOP } from '@/utils/cn'

interface PageProps {
  searchParams: Promise<{ estado?: string; offset?: string }>
}

export default async function CotizacionesPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const estado = sp.estado ?? ''
  const offset = parseInt(sp.offset ?? '0')

  const [{ cotizaciones, total }, stats] = await Promise.all([
    getCotizaciones({ estado: estado || undefined, limit: 50, offset }),
    getEstadisticasCotizaciones(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
          <FileText className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500">Propuestas de venta a clientes</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',       val: stats.total,      mono: false },
          { label: 'Borrador',    val: stats.borrador,   mono: false },
          { label: 'Aprobadas',   val: stats.aprobada,   mono: false },
          { label: 'Valor aprob.', val: formatCOP(stats.valor), mono: true, color: 'text-green-700' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-2xl font-bold mt-1 ${k.mono ? 'font-mono text-lg' : ''} ${k.color ?? 'text-gray-900 dark:text-gray-100'}`}>{k.val}</p>
          </div>
        ))}
      </div>

      <ListaCotizaciones
        cotizaciones={cotizaciones as unknown as Parameters<typeof ListaCotizaciones>[0]['cotizaciones']}
        total={total}
        estadoFiltro={estado}
      />
    </div>
  )
}
