import { NextRequest, NextResponse } from 'next/server'
import { getPyG } from '@/lib/db/informes'
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

  const { ingresos, costos, gastos, total_ingresos, total_costos, total_gastos, utilidad } =
    await getPyG({ desde, hasta })

  const getSaldo = (row: { debe: number; haber: number; naturaleza: string }) =>
    row.naturaleza === 'credito' ? row.haber - row.debe : row.debe - row.haber
  const toRows = (tipo: string, rows: typeof ingresos) =>
    rows.map((row) => [tipo, row.codigo, row.descripcion, row.debe, row.haber, getSaldo(row)])

  const rows = [
    ...toRows('Ingreso', ingresos),
    ['TOTAL INGRESOS', '', '', '', '', total_ingresos],
    ...toRows('Costo', costos),
    ['TOTAL COSTOS', '', '', '', '', total_costos],
    ...toRows('Gasto', gastos),
    ['TOTAL GASTOS', '', '', '', '', total_gastos],
    ['UTILIDAD', '', '', '', '', utilidad],
  ]

  return createExportResponse({
    format,
    baseFilename: `pyg_${desde}_${hasta}`,
    headers: ['Tipo', 'Código', 'Descripción', 'Debe', 'Haber', 'Saldo'],
    rows,
    sheetName: 'PyG',
  })
}
