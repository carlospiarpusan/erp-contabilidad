import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getLibroDiarioRows } from '@/lib/db/compliance'
import { createExportResponse, resolveExportFormat, type CsvCell } from '@/lib/utils/csv'

function mapRows(rows: Array<Record<string, CsvCell>>, headers: string[]) {
  return rows.map((row) => headers.map((header) => row[header]))
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? undefined
    const hasta = searchParams.get('hasta') ?? undefined
    const format = resolveExportFormat(searchParams.get('format'))
    const rawRows = await getLibroDiarioRows({ desde, hasta })
    const headers = ['asiento_numero', 'fecha', 'tipo', 'tipo_doc', 'concepto', 'cuenta_codigo', 'cuenta_descripcion', 'linea_descripcion', 'debe', 'haber']

    return createExportResponse({
      format,
      baseFilename: `libro-diario-${new Date().toISOString().split('T')[0]}`,
      headers: ['Asiento', 'Fecha', 'Tipo', 'Tipo Doc', 'Concepto', 'Cuenta', 'Descripción Cuenta', 'Descripción Línea', 'Debe', 'Haber'],
      rows: mapRows(rawRows, headers),
      sheetName: 'Libro Diario',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
