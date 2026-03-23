import { NextRequest, NextResponse } from 'next/server'
import { getInformeVentasPorMedioPago } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    const forma_pago_id = searchParams.get('forma_pago_id') ?? ''
    const format = resolveExportFormat(searchParams.get('format'))

    const { medios } = await getInformeVentasPorMedioPago({
      desde: desde || undefined,
      hasta: hasta || undefined,
      forma_pago_id: forma_pago_id || undefined,
    })

    const headers = [
      'Medio de pago',
      'Facturas',
      'Pagadas',
      'Pendientes',
      'Ticket promedio',
      'Ventas',
      'Ultima factura',
    ]

    const rows = medios.map((medio) => ([
      medio.descripcion,
      medio.facturas,
      medio.pagadas,
      medio.pendientes,
      medio.ticket_promedio,
      medio.total,
      medio.ultima_fecha ?? '',
    ]))

    return createExportResponse({
      format,
      baseFilename: `ventas-por-medio-pago-${new Date().toISOString().split('T')[0]}`,
      headers,
      rows,
      sheetName: 'Ventas medio pago',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
