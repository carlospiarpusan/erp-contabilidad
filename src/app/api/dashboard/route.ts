import { NextRequest, NextResponse } from 'next/server'
import { getKPIs, getUltimasFacturas, getAlertasStock, getFacturasVencidas, getResumenMensual } from '@/lib/db/dashboard'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const año = parseInt(searchParams.get('año') ?? String(new Date().getFullYear()))

    const [kpis, ultimas_facturas, alertas_stock, facturas_vencidas, resumen_mensual] =
      await Promise.all([
        getKPIs(),
        getUltimasFacturas(),
        getAlertasStock(),
        getFacturasVencidas(),
        getResumenMensual(año),
      ])

    return NextResponse.json({
      kpis,
      ultimas_facturas,
      alertas_stock,
      facturas_vencidas,
      resumen_mensual,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
