import { NextRequest, NextResponse } from 'next/server'
import { getInformeVentasPorMedioPago } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    const forma_pago_id = searchParams.get('forma_pago_id') ?? ''

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

    const csv = [
      headers.join(','),
      ...medios.map((medio) => ([
        escapeCsv(medio.descripcion),
        medio.facturas,
        medio.pagadas,
        medio.pendientes,
        medio.ticket_promedio,
        medio.total,
        escapeCsv(medio.ultima_fecha ?? ''),
      ].join(','))),
    ].join('\n')

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ventas-por-medio-pago-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
