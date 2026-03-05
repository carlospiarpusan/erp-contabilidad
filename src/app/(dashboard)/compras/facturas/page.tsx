export const dynamic = 'force-dynamic'

import { getCompras, getEstadisticasCompras, getProveedorById } from '@/lib/db/compras'
import { ListaCompras } from '@/components/compras/ListaCompras'
import { formatCOP } from '@/utils/cn'
import { ShoppingCart, Clock, CheckCircle, TrendingDown } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ proveedor_id?: string }>
}

export default async function ComprasPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const [{ compras, total }, stats, proveedor] = await Promise.all([
    getCompras({ limit: 100, proveedor_id: sp.proveedor_id ?? undefined }),
    getEstadisticasCompras(),
    sp.proveedor_id ? getProveedorById(sp.proveedor_id).catch(() => null) : Promise.resolve(null),
  ])

  const kpis = [
    { label: 'Total facturas',  value: stats.total.toString(),        icon: ShoppingCart, color: 'bg-orange-100 text-orange-600' },
    { label: 'Por pagar',       value: formatCOP(stats.pendiente),    icon: Clock,        color: 'bg-yellow-100 text-yellow-600' },
    { label: 'Pagado',          value: formatCOP(stats.pagada),       icon: CheckCircle,  color: 'bg-green-100  text-green-600'  },
    { label: 'Este mes',        value: formatCOP(stats.este_mes),     icon: TrendingDown, color: 'bg-blue-100   text-blue-600'   },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600">
          <ShoppingCart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Facturas de compra</h1>
          <p className="text-sm text-gray-500">{total} factura{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* KPIs */}
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

      <ListaCompras
        compras={compras as unknown as Parameters<typeof ListaCompras>[0]['compras']}
        total={total}
        proveedor_id={sp.proveedor_id}
        proveedorNombre={(proveedor as { razon_social?: string } | null)?.razon_social}
      />
    </div>
  )
}
