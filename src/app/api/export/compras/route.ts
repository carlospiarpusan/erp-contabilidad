import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? ''
    const hasta = searchParams.get('hasta') ?? ''

    const supabase = await createClient()
    let query = supabase
      .from('documentos')
      .select('numero, prefijo, numero_externo, fecha, estado, subtotal, total_iva, total_descuento, total, proveedor:proveedor_id(razon_social, numero_documento)')
      .eq('tipo', 'factura_compra')
      .neq('estado', 'cancelada')
      .order('fecha', { ascending: false })

    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

    const { data, error } = await query
    if (error) throw error

    const rows = data ?? []
    const headers = ['Número', 'Prefijo', 'F. Proveedor', 'Fecha', 'Estado', 'Proveedor', 'Documento', 'Subtotal', 'IVA', 'Descuento', 'Total']
    const csv = [
      headers.join(','),
      ...rows.map(r => {
        const p = r.proveedor as { razon_social?: string; numero_documento?: string } | null
        return [
          r.numero, r.prefijo ?? '',
          r.numero_externo ?? '', r.fecha, r.estado,
          `"${(p?.razon_social ?? '').replace(/"/g, '""')}"`,
          p?.numero_documento ?? '',
          r.subtotal ?? 0, r.total_iva ?? 0, r.total_descuento ?? 0, r.total ?? 0,
        ].join(',')
      }),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="compras-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
