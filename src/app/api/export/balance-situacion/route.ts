import { NextRequest, NextResponse } from 'next/server'
import { getBalanceSituacion } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const sp         = req.nextUrl.searchParams
  const fecha_corte = sp.get('fecha') || new Date().toISOString().split('T')[0]
  const format = resolveExportFormat(sp.get('format'))

  const { activos, pasivos, patrimonio, total_activos, total_pasivos, total_patrimonio } =
    await getBalanceSituacion({ fecha_corte })

  const getSaldo = (row: { debe: number; haber: number; naturaleza: string }) =>
    row.naturaleza === 'credito' ? row.haber - row.debe : row.debe - row.haber
  const toRows = (tipo: string, rows: typeof activos) =>
    rows.map((row) => [tipo, row.codigo, row.descripcion, getSaldo(row)])

  const rows = [
    ...toRows('Activo', activos),
    ['TOTAL ACTIVOS', '', '', total_activos],
    ...toRows('Pasivo', pasivos),
    ['TOTAL PASIVOS', '', '', total_pasivos],
    ...toRows('Patrimonio', patrimonio),
    ['TOTAL PATRIMONIO', '', '', total_patrimonio],
  ]

  return createExportResponse({
    format,
    baseFilename: `balance-situacion_${fecha_corte}`,
    headers: ['Tipo', 'Código', 'Descripción', 'Saldo'],
    rows,
    sheetName: 'Balance',
  })
}
