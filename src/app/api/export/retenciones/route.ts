import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getRetencionesAplicadasRows } from '@/lib/db/compliance'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? undefined
    const hasta = searchParams.get('hasta') ?? undefined
    const format = resolveExportFormat(searchParams.get('format'))
    const rows = (await getRetencionesAplicadasRows({ desde, hasta })).map((item) => [
      item.fecha,
      item.documento,
      item.tipo_documento,
      item.tercero,
      item.tercero_documento,
      item.retencion_tipo,
      item.retencion_nombre,
      item.base_gravable,
      item.porcentaje,
      item.valor,
    ])

    return createExportResponse({
      format,
      baseFilename: `retenciones-${new Date().toISOString().split('T')[0]}`,
      headers: ['Fecha', 'Documento', 'Tipo documento', 'Tercero', 'Documento tercero', 'Tipo retención', 'Retención', 'Base gravable', 'Porcentaje', 'Valor'],
      rows,
      sheetName: 'Retenciones',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
