import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { createExportResponse, resolveExportFormat } from '@/lib/utils/csv'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''
    const format = resolveExportFormat(searchParams.get('format'))

    const supabase = await createClient()
    const pageSize = 500

    async function* rows() {
      let offset = 0

      while (true) {
        let query = supabase
          .from('documentos')
          .select('numero, prefijo, fecha, estado, subtotal, total_iva, total_descuento, total, cliente:cliente_id(razon_social, numero_documento)')
          .eq('tipo', 'factura_venta')
          .neq('estado', 'cancelada')
          .order('fecha', { ascending: false })
          .order('numero', { ascending: false })
          .range(offset, offset + pageSize - 1)

        if (desde) query = query.gte('fecha', desde)
        if (hasta) query = query.lte('fecha', hasta)

        const { data, error } = await query
        if (error) throw error

        const batch = data ?? []
        if (!batch.length) break

        for (const row of batch) {
          const cliente = row.cliente as { razon_social?: string; numero_documento?: string } | null
          yield [
            row.numero,
            row.prefijo ?? '',
            row.fecha,
            row.estado,
            cliente?.razon_social ?? '',
            cliente?.numero_documento ?? '',
            row.subtotal ?? 0,
            row.total_iva ?? 0,
            row.total_descuento ?? 0,
            row.total ?? 0,
          ]
        }

        if (batch.length < pageSize) break
        offset += pageSize
      }
    }

    return createExportResponse({
      format,
      baseFilename: `ventas-${new Date().toISOString().split('T')[0]}`,
      headers: ['Número', 'Prefijo', 'Fecha', 'Estado', 'Cliente', 'Documento', 'Subtotal', 'IVA', 'Descuento', 'Total'],
      rows: rows(),
      sheetName: 'Ventas',
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
