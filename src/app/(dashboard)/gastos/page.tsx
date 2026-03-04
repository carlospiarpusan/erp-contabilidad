export const dynamic = 'force-dynamic'

import { getGastos, getEstadisticasGastos } from '@/lib/db/gastos'
import { ListaGastos } from '@/components/gastos/ListaGastos'
import { formatCOP } from '@/utils/cn'
import { Receipt, TrendingDown, Calendar, BarChart3 } from 'lucide-react'

export default async function GastosPage() {
  const [{ gastos, total }, stats] = await Promise.all([
    getGastos({ limit: 200 }),
    getEstadisticasGastos(),
  ])

  const kpis = [
    { label: 'Total gastos',   value: stats.total.toString(),       icon: Receipt,     color: 'bg-purple-100 text-purple-600' },
    { label: 'Total acumulado', value: formatCOP(stats.total_monto), icon: BarChart3,   color: 'bg-gray-100    text-gray-600'   },
    { label: 'Este mes',       value: formatCOP(stats.este_mes),    icon: Calendar,    color: 'bg-blue-100   text-blue-600'    },
    { label: 'Este año',       value: formatCOP(stats.este_anio),   icon: TrendingDown, color: 'bg-red-100   text-red-600'     },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600">
          <Receipt className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gastos</h1>
          <p className="text-sm text-gray-500">{total} gasto{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-gray-100 bg-white p-4 flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${k.color}`}>
              <k.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="font-bold text-gray-900 text-sm">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <ListaGastos gastos={gastos as unknown as Parameters<typeof ListaGastos>[0]['gastos']} total={total} />
    </div>
  )
}
