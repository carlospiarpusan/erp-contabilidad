export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { formatCOP, formatFecha } from '@/utils/cn'
import Link from 'next/link'
import { ChevronLeft, AlertTriangle } from 'lucide-react'

async function getCuentasPorPagar() {
  const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
  const hoy = new Date()

  const { data } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, fecha_vencimiento, total,
      proveedor:proveedores(id, razon_social, numero_documento, email),
      recibos(valor)
    `)
    .eq('empresa_id', empresa_id)
    .eq('tipo', 'factura_compra')
    .eq('estado', 'pendiente')
    .order('fecha_vencimiento', { ascending: true })

  return (data ?? []).map((doc: any) => {
    const pagado = (doc.recibos ?? []).reduce((s: number, r: any) => s + (r.valor ?? 0), 0)
    const saldo = doc.total - pagado
    const vencimiento = doc.fecha_vencimiento ? new Date(doc.fecha_vencimiento) : null
    const diasVencido = vencimiento ? Math.floor((hoy.getTime() - vencimiento.getTime()) / 86400000) : null
    let rango: string = 'vigente'
    if (diasVencido !== null && diasVencido > 0) {
      if (diasVencido <= 30) rango = '0-30 días'
      else if (diasVencido <= 60) rango = '31-60 días'
      else if (diasVencido <= 90) rango = '61-90 días'
      else rango = '+90 días'
    }
    return { id: doc.id, numero: `${doc.prefijo}${doc.numero}`, fecha: doc.fecha, fecha_vencimiento: doc.fecha_vencimiento, total: doc.total, pagado, saldo, rango, proveedor: doc.proveedor }
  }).filter((f: any) => f.saldo > 0.01)
}

const RANGO_COLOR: Record<string, string> = {
  'vigente': 'bg-green-50 text-green-700',
  '0-30 días': 'bg-yellow-50 text-yellow-700',
  '31-60 días': 'bg-orange-50 text-orange-700',
  '61-90 días': 'bg-red-50 text-red-600',
  '+90 días': 'bg-red-100 text-red-700 font-bold',
}

export default async function CuentasPorPagarPage() {
  const filas = await getCuentasPorPagar()
  const total = filas.reduce((s, f) => s + f.saldo, 0)

  const porProveedor: Record<string, { proveedor: any; facturas: typeof filas; total: number }> = {}
  for (const f of filas) {
    const pid = f.proveedor?.id ?? '__sin__'
    if (!porProveedor[pid]) porProveedor[pid] = { proveedor: f.proveedor, facturas: [], total: 0 }
    porProveedor[pid].facturas.push(f)
    porProveedor[pid].total += f.saldo
  }
  const grupos = Object.values(porProveedor).sort((a, b) => b.total - a.total)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/informes/balances" className="hover:text-gray-700 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Informes
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cuentas por Pagar</h1>
          <p className="text-sm text-gray-500">Facturas de compra pendientes de pago</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total por pagar</p>
          <p className="text-2xl font-bold text-red-600">{formatCOP(total)}</p>
        </div>
      </div>

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

      {grupos.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-12">Sin saldos pendientes</p>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map(({ proveedor, facturas, total: totProv }) => (
            <div key={proveedor?.id ?? '__sin__'} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{proveedor?.razon_social ?? 'Sin proveedor'}</p>
                  <p className="text-xs text-gray-500">{proveedor?.numero_documento}</p>
                </div>
                <span className="font-bold text-red-600 text-sm">{formatCOP(totProv)}</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Factura</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Fecha</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Vencimiento</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Total</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Saldo</th>
                    <th className="px-4 py-2 text-center text-gray-500 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {facturas.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2">
                        <Link href={`/compras/facturas/${f.id}`} className="text-blue-600 hover:underline font-mono">{f.numero}</Link>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{formatFecha(f.fecha)}</td>
                      <td className="px-4 py-2 text-gray-500">{f.fecha_vencimiento ? formatFecha(f.fecha_vencimiento) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCOP(f.total)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-red-600">{formatCOP(f.saldo)}</td>
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
