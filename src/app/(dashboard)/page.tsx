import { KPICard } from '@/components/dashboard/KPICard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, TrendingUp, ShoppingCart, DollarSign, Percent, AlertTriangle } from 'lucide-react'
import { formatCOP, formatFecha } from '@/utils/cn'
import { createClient } from '@/lib/supabase/server'
import {
  getKPIs,
  getUltimasFacturas,
  getAlertasStock,
  getFacturasVencidas,
  getResumenMensual,
} from '@/lib/db/dashboard'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// Datos de ejemplo cuando Supabase aún no está configurado
const datosMock = {
  kpis: { facturas_activas: 682, total_facturado: 842061000, costos_ventas: 464585128, ganancias: 377475872, margen_porcentaje: 44.83 },
  ultimasFacturas: [
    { id: '1', numero: 1359, prefijo: 'F', cliente: { razon_social: 'CONSUMIDOR FINAL' }, total: 1040000, estado: 'pagada',   fecha: '2025-12-31' },
    { id: '2', numero: 1358, prefijo: 'F', cliente: { razon_social: 'Martha Gómez' },      total: 580000,  estado: 'pendiente', fecha: '2025-12-30' },
    { id: '3', numero: 1357, prefijo: 'F', cliente: { razon_social: 'Clínica Ipiales' },   total: 2150000, estado: 'pagada',   fecha: '2025-12-29' },
    { id: '4', numero: 1356, prefijo: 'F', cliente: { razon_social: 'CONSUMIDOR FINAL' },  total: 320000,  estado: 'pendiente', fecha: '2025-12-29' },
    { id: '5', numero: 1355, prefijo: 'F', cliente: { razon_social: 'Adriana Paz' },       total: 890000,  estado: 'pagada',   fecha: '2025-12-28' },
  ],
  alertasStock: [],
  facturasVencidas: [],
  resumenMensual: [
    { mes: 1, ventas: 57246000 }, { mes: 2, ventas: 52116000 }, { mes: 3, ventas: 61800000 },
    { mes: 4, ventas: 48500000 }, { mes: 5, ventas: 70200000 }, { mes: 6, ventas: 65000000 },
  ],
}

async function cargarDatos() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const [kpis, ultimasFacturas, alertasStock, facturasVencidas, resumenMensual] =
      await Promise.allSettled([getKPIs(), getUltimasFacturas(), getAlertasStock(), getFacturasVencidas(), getResumenMensual()])

    return {
      kpis:             kpis.status === 'fulfilled'             ? kpis.value            : null,
      ultimasFacturas:  ultimasFacturas.status === 'fulfilled'  ? ultimasFacturas.value : [],
      alertasStock:     alertasStock.status === 'fulfilled'     ? alertasStock.value    : [],
      facturasVencidas: facturasVencidas.status === 'fulfilled' ? facturasVencidas.value : [],
      resumenMensual:   resumenMensual.status === 'fulfilled'   ? resumenMensual.value  : [],
    }
  } catch {
    return null
  }
}

export default async function DashboardPage() {
  const datos = await cargarDatos() ?? datosMock
  const { kpis, ultimasFacturas, alertasStock, facturasVencidas, resumenMensual } = datos
  const maxVentas = Math.max(...(resumenMensual as any[]).map((m) => m.ventas), 1)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Resumen General</h2>
        <p className="text-sm text-gray-500">Ejercicio {new Date().getFullYear()}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KPICard titulo="Facturas Activas" valor={(kpis?.facturas_activas ?? 0).toLocaleString('es-CO')} icono={FileText}    color="blue"   tendencia={8} />
        <KPICard titulo="Total Facturado"  valor={formatCOP(kpis?.total_facturado ?? 0)}  subtitulo="Acumulado año"      icono={TrendingUp}  color="green"  tendencia={12} />
        <KPICard titulo="Costo de Ventas"  valor={formatCOP(kpis?.costos_ventas ?? 0)}    subtitulo="Mercancía vendida"  icono={ShoppingCart} color="orange" />
        <KPICard titulo="Ganancias Netas"  valor={formatCOP(kpis?.ganancias ?? 0)}        subtitulo="Ventas - Costos"    icono={DollarSign}  color="purple" tendencia={5} />
        <KPICard titulo="Margen"           valor={`${kpis?.margen_porcentaje ?? 0}%`}     subtitulo="Margen de ganancia" icono={Percent}     color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Últimas facturas */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Últimas Facturas de Venta</span>
                <a href="/ventas/facturas" className="text-sm font-normal text-blue-600 hover:underline">Ver todas →</a>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="pb-3 font-medium">Nº</th>
                    <th className="pb-3 font-medium">Cliente</th>
                    <th className="pb-3 font-medium">Fecha</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(ultimasFacturas as any[]).map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="py-3 font-medium text-blue-600">{f.prefijo}{f.numero}</td>
                      <td className="py-3 text-gray-700">{f.cliente?.razon_social ?? '—'}</td>
                      <td className="py-3 text-gray-400">{formatFecha(f.fecha)}</td>
                      <td className="py-3 text-right font-medium">{formatCOP(f.total)}</td>
                      <td className="py-3 text-right">
                        <Badge variant={f.estado === 'pagada' ? 'success' : 'warning'}>
                          {f.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Ventas por Mes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                {(resumenMensual as any[]).map((m) => (
                  <div key={m.mes} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{MESES[m.mes - 1]}</span>
                      <span className="font-medium text-gray-900">{formatCOP(m.ventas)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((m.ventas / maxVentas) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" /> Alertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-sm">
                {(alertasStock as any[]).length > 0 && (
                  <div className="rounded-lg bg-orange-50 p-3">
                    <p className="font-medium text-orange-800">Stock bajo</p>
                    <p className="text-xs text-orange-600">{(alertasStock as any[]).length} productos por debajo del mínimo</p>
                  </div>
                )}
                {(facturasVencidas as any[]).length > 0 && (
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="font-medium text-red-800">Facturas vencidas</p>
                    <p className="text-xs text-red-600">{(facturasVencidas as any[]).length} facturas sin pagar</p>
                  </div>
                )}
                {(alertasStock as any[]).length === 0 && (facturasVencidas as any[]).length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-2">Sin alertas pendientes ✓</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
