import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getFaltantesSoporteRows } from '@/lib/db/compliance'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const format = resolveExportFormat(searchParams.get('format'))
    const rows = (await getFaltantesSoporteRows()).map((item) => [
      item.documento,
      item.fecha,
      item.factura_proveedor,
      item.proveedor,
      item.nit_proveedor,
      item.estado_soporte,
      item.numero_soporte,
      item.fecha_soporte,
      item.total_compra,
    ])

    return createExportResponse({
      format,
      baseFilename: `faltantes-soporte-${new Date().toISOString().split('T')[0]}`,
      headers: ['Documento', 'Fecha', 'Factura proveedor', 'Proveedor', 'NIT proveedor', 'Estado soporte', 'Número soporte', 'Fecha soporte', 'Total compra'],
      rows,
      sheetName: 'Faltantes Soporte',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
