import { NextRequest, NextResponse } from 'next/server'
import { getSumasYSaldos } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp    = req.nextUrl.searchParams
  const hoy   = new Date().toISOString().split('T')[0]
  const anio  = new Date().getFullYear()
  const desde = sp.get('desde') || `${anio}-01-01`
  const hasta  = sp.get('hasta')  || hoy
  const format = resolveExportFormat(sp.get('format'))

  const rows = await getSumasYSaldos({ desde, hasta })

  return createExportResponse({
    format,
    baseFilename: `sumas-saldos_${desde}_${hasta}`,
    headers: ['Código', 'Descripción', 'Tipo', 'Nivel', 'Debe', 'Haber', 'Saldo'],
    rows: rows.map((row) => [row.codigo, row.descripcion, row.tipo, row.nivel, row.debe, row.haber, row.saldo]),
    sheetName: 'Sumas y saldos',
  })
}
