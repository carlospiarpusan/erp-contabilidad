import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, referencia, precio_venta, precio_compra, stock_actual, stock_minimo, activo, categoria:categoria_id(descripcion), unidad:unidad_id(descripcion)')
      .order('descripcion')

    if (error) throw error

    const rows = data ?? []
    const headers = ['Código', 'Descripción', 'Referencia', 'Categoría', 'Unidad', 'Precio Venta', 'Precio Compra', 'Stock Actual', 'Stock Mínimo', 'Activo']
    const csv = [
      headers.join(','),
      ...rows.map(r => {
        const cat = r.categoria as { descripcion?: string } | null
        const uni = r.unidad as { descripcion?: string } | null
        return [
          r.codigo ?? '',
          `"${(r.descripcion ?? '').replace(/"/g, '""')}"`,
          r.referencia ?? '',
          `"${(cat?.descripcion ?? '').replace(/"/g, '""')}"`,
          uni?.descripcion ?? '',
          r.precio_venta ?? 0, r.precio_compra ?? 0,
          r.stock_actual ?? 0, r.stock_minimo ?? 0,
          r.activo ? 'Sí' : 'No',
        ].join(',')
      }),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventario-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
