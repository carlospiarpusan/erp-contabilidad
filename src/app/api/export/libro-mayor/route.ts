import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getLibroMayor } from '@/lib/db/informes'
import { createClient } from '@/lib/supabase/server'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const codigoCuenta = searchParams.get('codigo_cuenta') ?? ''
    const desde = searchParams.get('desde') ?? `${new Date().getFullYear()}-01-01`
    const hasta = searchParams.get('hasta') ?? new Date().toISOString().split('T')[0]
    const format = resolveExportFormat(searchParams.get('format'))
    if (!codigoCuenta) {
      return NextResponse.json({ error: 'codigo_cuenta requerido' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: cuenta, error: cuentaError } = await supabase
      .from('cuentas_puc')
      .select('id')
      .eq('codigo', codigoCuenta)
      .maybeSingle()

    if (cuentaError || !cuenta?.id) {
      return NextResponse.json({ error: 'No se encontró la cuenta solicitada' }, { status: 404 })
    }

    const result = await getLibroMayor({ cuenta_id: cuenta.id, desde, hasta })
    const rows = (result.movimientos ?? []).map((item) => [
      item.fecha,
      item.numero,
      item.tipo_doc,
      item.concepto,
      item.debe,
      item.haber,
      item.saldo,
    ])

    return createExportResponse({
      format,
      baseFilename: `libro-mayor-${new Date().toISOString().split('T')[0]}`,
      headers: ['Fecha', 'Asiento', 'Tipo Doc', 'Concepto', 'Debe', 'Haber', 'Saldo'],
      rows,
      sheetName: 'Libro Mayor',
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 })
  }
}
