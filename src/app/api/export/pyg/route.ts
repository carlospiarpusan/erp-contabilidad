import { NextRequest, NextResponse } from 'next/server'
import { getPyG } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp    = req.nextUrl.searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.get('desde') || `${anio}-01-01`
  const hasta  = sp.get('hasta')  || hoy

  const { ingresos, costos, gastos, total_ingresos, total_costos, total_gastos, utilidad } =
    await getPyG({ desde, hasta })

  const header = 'Tipo,Código,Descripción,Debe,Haber,Saldo'
  const toLines = (tipo: string, rows: typeof ingresos) =>
    rows.map(r => [tipo, r.codigo, `"${r.descripcion}"`, r.debe, r.haber, r.saldo].join(','))

  const lines = [
    ...toLines('Ingreso', ingresos),
    `TOTAL INGRESOS,,,,, ${total_ingresos}`,
    ...toLines('Costo', costos),
    `TOTAL COSTOS,,,,, ${total_costos}`,
    ...toLines('Gasto', gastos),
    `TOTAL GASTOS,,,,, ${total_gastos}`,
    `UTILIDAD,,,,, ${utilidad}`,
  ]

  const csv = [header, ...lines].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pyg_${desde}_${hasta}.csv"`,
    },
  })
}
