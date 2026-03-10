import { NextRequest, NextResponse } from 'next/server'
import { getSumasYSaldos } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp    = req.nextUrl.searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.get('desde') || `${anio}-01-01`
  const hasta  = sp.get('hasta')  || hoy

  const rows = await getSumasYSaldos({ desde, hasta })

  const header = 'Código,Descripción,Tipo,Nivel,Debe,Haber,Saldo'
  const lines  = rows.map(r =>
    [r.codigo, `"${r.descripcion}"`, r.tipo, r.nivel, r.debe, r.haber, r.saldo].join(',')
  )
  const csv = [header, ...lines].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="sumas-saldos_${desde}_${hasta}.csv"`,
    },
  })
}
