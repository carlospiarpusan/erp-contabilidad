export const dynamic = 'force-dynamic'

import { getInformeCartera } from '@/lib/db/informes'
import { formatCOP, formatFecha , cardCls , cn } from '@/utils/cn'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { RecordatorioCobroButton } from '@/components/shared/RecordatorioCobroButton'

const RANGO_COLOR: Record<string, string> = {
  'vigente': 'bg-green-50 text-green-700',
  '0-30 días': 'bg-yellow-50 text-yellow-700',
  '31-60 días': 'bg-orange-50 text-orange-700',
  '61-90 días': 'bg-red-50 text-red-600',
  '+90 días': 'bg-red-100 text-red-700 font-bold',
}

export default async function CarteraPage() {
  const { filas, total } = await getInformeCartera()

  const porCliente: Record<string, { deudor: typeof filas[number]['deudor']; facturas: typeof filas; total: number }> = {}
  for (const f of filas) {
    const cid = f.deudor.id ?? '__sistecredito__'
    if (!porCliente[cid]) porCliente[cid] = { deudor: f.deudor, facturas: [], total: 0 }
    porCliente[cid].facturas.push(f)
    porCliente[cid].total += f.saldo
  }
  const grupos = Object.values(porCliente).sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/informes/balances" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Informes
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Informe de Cartera</h1>
          <p className="text-sm text-gray-500">Facturas de venta pendientes de cobro</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total en cartera</p>
          <p className="text-2xl font-bold text-orange-600">{formatCOP(total)}</p>
        </div>
      </div>

      {/* Resumen por rango */}
      {['vigente', '0-30 días', '31-60 días', '61-90 días', '+90 días'].map(rango => {
        const tot = filas.filter(f => f.rango === rango).reduce((s, f) => s + f.saldo, 0)
        if (tot === 0) return null
        return (
          <div key={rango} className={`flex justify-between items-center rounded-xl px-4 py-3 ${RANGO_COLOR[rango] ?? ''}`}>
            <div className="flex items-center gap-2">
              {rango !== 'vigente' && <AlertTriangle className="h-4 w-4" />}
              <span className="text-sm font-medium">{rango === 'vigente' ? 'Por vencer' : `Vencido ${rango}`}</span>
            </div>
            <span className="font-bold">{formatCOP(tot)}</span>
          </div>
        )
      })}

      {/* Por cliente */}
      {grupos.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Sin saldos pendientes</p>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map(({ deudor, facturas, total: totCliente }) => (
            <div key={deudor.id ?? '__sistecredito__'} className={cn(cardCls, 'overflow-hidden')}>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{deudor.razon_social}</p>
                  <p className="text-xs text-gray-500">{deudor.numero_documento ?? (deudor.tipo === 'sistecredito' ? 'Recaudo consolidado por convenio' : '')}</p>
                </div>
                <div className="flex items-center gap-3">
                  {deudor.tipo === 'cliente' && deudor.email && deudor.id && (
                    <RecordatorioCobroButton clienteId={deudor.id} emailCliente={deudor.email} />
                  )}
                  <span className="font-bold text-orange-600 text-sm">{formatCOP(totCliente)}</span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Factura</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Cliente</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Fecha</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Cobro esperado</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Total</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Saldo</th>
                    <th className="px-4 py-2 text-center text-gray-500 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {facturas.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2">
                        <Link href={`/ventas/facturas/${f.id}`} className="text-blue-600 hover:underline font-mono">{f.numero}</Link>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{f.cliente?.razon_social ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{formatFecha(f.fecha)}</td>
                      <td className="px-4 py-2 text-gray-500">{f.fecha_gestion ? formatFecha(f.fecha_gestion) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCOP(f.total)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-orange-600">{formatCOP(f.saldo)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${RANGO_COLOR[f.rango] ?? 'bg-gray-100 text-gray-600'}`}>
                          {f.rango}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
