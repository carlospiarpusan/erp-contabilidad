import { NextRequest, NextResponse } from 'next/server'
import { getKPIs, getUltimasFacturas, getAlertasStock, getFacturasVencidas, getResumenMensual } from '@/lib/db/dashboard'

export async function GET(req: NextRequest) {
  try {
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
