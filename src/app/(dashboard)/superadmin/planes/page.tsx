export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CreditCard, Hash, Banknote, TrendingUp } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { listBillingPaymentsFiltered, listBillingProducts, type FilteredPaymentRow } from '@/lib/billing/service'
import type { BillingProductCode } from '@/lib/billing/types'
import { FiltrosPagos, PaginacionPagos } from '@/components/superadmin/FiltrosPagos'
import { Tabla, FilaTabla, CeldaTabla } from '@/components/ui/tabla'
import { Badge } from '@/components/ui/badge'
import { cardCls, formatCOP } from '@/utils/cn'

const LIMIT = 30

const TIPO_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  payment: { label: 'Pago', variant: 'success' },
  adjustment: { label: 'Ajuste', variant: 'warning' },
  extension: { label: 'Extensión', variant: 'info' },
}

const COLUMNAS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'producto', label: 'Producto' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'intervalo', label: 'Intervalo' },
  { key: 'valor', label: 'Valor', className: 'text-right' },
  { key: 'referencia', label: 'Referencia' },
]

interface PageProps {
  searchParams: Promise<{
    producto?: string
    tipo?: string
    desde?: string
    hasta?: string
    q?: string
    offset?: string
  }>
}

export default async function SuperadminPlanesPage({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') redirect('/')

  const sp = await searchParams
  const offset = parseInt(sp.offset ?? '0')

  const [{ data: payments, total, sum_cop }, products] = await Promise.all([
    listBillingPaymentsFiltered({
      product_code: sp.producto as BillingProductCode | undefined,
      tipo: sp.tipo,
      desde: sp.desde,
      hasta: sp.hasta,
      search: sp.q,
      offset,
      limit: LIMIT,
    }),
    listBillingProducts(),
  ])

  const productNames: Record<string, string> = {}
  for (const p of products) productNames[p.product_code] = p.nombre

  const avg = total > 0 ? Math.round(sum_cop / total) : 0

  return (
    <div className="flex max-w-6xl flex-col gap-3">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-gray-400" />
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Seguimiento de pagos</h1>
        <span className="text-xs text-gray-400">— Cobros registrados por producto</span>
      </div>

      <Suspense>
        <FiltrosPagos products={products.map((p) => ({ product_code: p.product_code, nombre: p.nombre }))} />
      </Suspense>

      <div className="grid grid-cols-3 gap-2">
        <div className={`${cardCls} flex items-center gap-2.5 px-3 py-2`}>
          <Hash className="h-3.5 w-3.5 text-gray-400" />
          <div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Cobros</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{total.toLocaleString('es-CO')}</p>
          </div>
        </div>
        <div className={`${cardCls} flex items-center gap-2.5 px-3 py-2`}>
          <Banknote className="h-3.5 w-3.5 text-gray-400" />
          <div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Total</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCOP(sum_cop)}</p>
          </div>
        </div>
        <div className={`${cardCls} flex items-center gap-2.5 px-3 py-2`}>
          <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
          <div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Promedio</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">{formatCOP(avg)}</p>
          </div>
        </div>
      </div>

      {payments.length === 0 ? (
        <div className={`${cardCls} px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400`}>
          No se encontraron cobros con los filtros seleccionados.
        </div>
      ) : (
        <Tabla columnas={COLUMNAS}>
          {payments.map((p) => (
            <PaymentRow key={p.id} payment={p} productNames={productNames} />
          ))}
        </Tabla>
      )}

      <Suspense>
        <PaginacionPagos total={total} limit={LIMIT} offset={offset} />
      </Suspense>
    </div>
  )
}

function PaymentRow({ payment: p, productNames }: { payment: FilteredPaymentRow; productNames: Record<string, string> }) {
  const tipo = TIPO_MAP[p.tipo] ?? { label: p.tipo, variant: 'default' as const }
  const intervalo = p.billing_interval === 'annual' ? 'Anual' : p.billing_interval === 'monthly' ? 'Mensual' : '—'
  const ref = p.referencia_externa ?? p.transaction_id ?? '—'

  return (
    <FilaTabla>
      <CeldaTabla className="whitespace-nowrap text-xs">
        {new Date(p.fecha).toLocaleDateString('es-CO')}
      </CeldaTabla>
      <CeldaTabla className="max-w-[180px] truncate font-mono text-xs">
        {p.empresa_id}
      </CeldaTabla>
      <CeldaTabla>
        <Badge variant="outline">{productNames[p.product_code] ?? p.product_code}</Badge>
      </CeldaTabla>
      <CeldaTabla>
        <Badge variant={tipo.variant}>{tipo.label}</Badge>
      </CeldaTabla>
      <CeldaTabla className="text-xs text-gray-500 dark:text-gray-400">
        {intervalo}
      </CeldaTabla>
      <CeldaTabla className="text-right font-mono text-xs font-semibold">
        {formatCOP(p.valor_cop)}
      </CeldaTabla>
      <CeldaTabla className="max-w-[200px] truncate font-mono text-xs text-gray-500 dark:text-gray-400">
        {ref}
      </CeldaTabla>
    </FilaTabla>
  )
}
