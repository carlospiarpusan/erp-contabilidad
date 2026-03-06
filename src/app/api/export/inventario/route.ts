import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, descripcion, precio_venta, precio_compra, unidad_medida, activo, familia:familia_id(nombre, descripcion), stock(cantidad, cantidad_minima)')
      .order('descripcion')

    if (error) throw error

    const rows = data ?? []
    const headers = ['Código', 'Descripción', 'Familia', 'Unidad', 'Precio Venta', 'Precio Compra', 'Stock Actual', 'Stock Mínimo', 'Activo']
    const csv = [
      headers.join(','),
      ...rows.map(r => {
        const fam = r.familia as { nombre?: string; descripcion?: string } | null
        const stocks = Array.isArray(r.stock) ? r.stock : []
        const stockActual = stocks.reduce((s, st) => s + (st.cantidad ?? 0), 0)
        const stockMinimo = stocks.reduce((s, st) => s + (st.cantidad_minima ?? 0), 0)
        return [
          r.codigo ?? '',
          `"${(r.descripcion ?? '').replace(/"/g, '""')}"`,
          `"${(fam?.descripcion ?? fam?.nombre ?? '').replace(/"/g, '""')}"`,
          r.unidad_medida ?? '',
          r.precio_venta ?? 0, r.precio_compra ?? 0,
          stockActual, stockMinimo,
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
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
