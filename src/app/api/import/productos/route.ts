import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'

export async function POST(req: NextRequest) {
  try {
    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const resultados = await Promise.all(filas.map(async (f: Record<string, string>, i: number) => {
      const codigo      = f.codigo?.trim()
      const descripcion = f.descripcion?.trim()
      const precio_venta = parseFloat(f.precio_venta?.replace(/[^0-9.]/g, '') ?? '0')

      if (!codigo || !descripcion) {
        return { fila: i + 2, estado: 'error', mensaje: 'codigo y descripcion son requeridos' }
      }
      if (isNaN(precio_venta) || precio_venta < 0) {
        return { fila: i + 2, estado: 'error', mensaje: 'precio_venta inválido' }
      }

      const payload = {
        empresa_id,
        codigo,
        descripcion,
        precio_venta,
        precio_compra:  parseFloat(f.precio_compra?.replace(/[^0-9.]/g, '')  ?? '0') || 0,
        stock_actual:   parseFloat(f.stock_actual?.replace(/[^0-9.]/g, '')  ?? '0') || 0,
        stock_minimo:   parseFloat(f.stock_minimo?.replace(/[^0-9.]/g, '')  ?? '0') || 0,
        unidad:         f.unidad?.trim() || 'UND',
        activo: true,
      }

      const { error } = await supabase
        .from('productos')
        .upsert(payload, { onConflict: 'empresa_id,codigo' })

      if (error) return { fila: i + 2, estado: 'error', mensaje: error.message }
      return { fila: i + 2, estado: 'ok' }
    }))

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
