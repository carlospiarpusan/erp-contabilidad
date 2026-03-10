import { NextRequest, NextResponse } from 'next/server'
import { getBalanceSituacion } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const fecha_corte = sp.get('fecha') || new Date().toISOString().split('T')[0]

  const { activos, pasivos, patrimonio, total_activos, total_pasivos, total_patrimonio } =
    await getBalanceSituacion({ fecha_corte })

  const header = 'Tipo,Código,Descripción,Saldo'
  const toLines = (tipo: string, rows: typeof activos) =>
    rows.map(r => [tipo, r.codigo, `"${r.descripcion}"`, r.saldo].join(','))

  const lines = [
    ...toLines('Activo', activos),
    `TOTAL ACTIVOS,,, ${total_activos}`,
    ...toLines('Pasivo', pasivos),
    `TOTAL PASIVOS,,, ${total_pasivos}`,
    ...toLines('Patrimonio', patrimonio),
    `TOTAL PATRIMONIO,,, ${total_patrimonio}`,
  ]

  const csv = [header, ...lines].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="balance-situacion_${fecha_corte}.csv"`,
    },
  })
}
