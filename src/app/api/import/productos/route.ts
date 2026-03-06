import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'

function parseNumber(value: unknown) {
  const parsed = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export async function POST(req: NextRequest) {
  try {
    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const { data: principal } = await supabase
      .from('bodegas')
      .select('id')
      .eq('empresa_id', empresa_id)
      .eq('principal', true)
      .maybeSingle()

    let bodegaId = principal?.id ?? null
    if (!bodegaId) {
      const { data: primera } = await supabase
        .from('bodegas')
        .select('id')
        .eq('empresa_id', empresa_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (primera?.id) {
        bodegaId = primera.id
      } else {
        const codigo = `BOD-${String(Date.now()).slice(-6)}`
        const { data: creada, error: bodegaErr } = await supabase
          .from('bodegas')
          .insert({ empresa_id, codigo, nombre: 'Bodega Principal', principal: true, activa: true })
          .select('id')
          .single()
        if (bodegaErr) throw bodegaErr
        bodegaId = creada.id
      }
    }

    const resultados = await Promise.all(filas.map(async (f: Record<string, string>, i: number) => {
      const codigo      = f.codigo?.trim()
      const descripcion = f.descripcion?.trim()
      const precio_venta = parseNumber(f.precio_venta)

      if (!codigo || !descripcion) {
        return { fila: i + 2, estado: 'error', mensaje: 'codigo y descripcion son requeridos' }
      }
      if (isNaN(precio_venta) || precio_venta < 0) {
        return { fila: i + 2, estado: 'error', mensaje: 'precio_venta inválido' }
      }

      const precio_compra = parseNumber(f.precio_compra)
      const stock_actual = parseNumber(f.stock_actual ?? f.stock_inicial)
      const stock_minimo = parseNumber(f.stock_minimo)
      const unidad_medida = f.unidad_medida?.trim() || f.unidad?.trim() || 'UND'

      const payload = {
        empresa_id,
        codigo,
        descripcion,
        precio_venta,
        precio_compra,
        unidad_medida,
        activo: true,
      }

      const { data: producto, error } = await supabase
        .from('productos')
        .upsert(payload, { onConflict: 'empresa_id,codigo' })
        .select('id')
        .single()

      if (error) return { fila: i + 2, estado: 'error', mensaje: error.message }

      const tieneCamposStock = f.stock_actual !== undefined || f.stock_inicial !== undefined || f.stock_minimo !== undefined
      if (bodegaId && producto?.id && tieneCamposStock) {
        const { data: stockExistente } = await supabase
          .from('stock')
          .select('id')
          .eq('producto_id', producto.id)
          .eq('bodega_id', bodegaId)
          .is('variante_id', null)
          .maybeSingle()

        if (stockExistente?.id) {
          const { error: stockErr } = await supabase
            .from('stock')
            .update({ cantidad: stock_actual, cantidad_minima: stock_minimo })
            .eq('id', stockExistente.id)
          if (stockErr) return { fila: i + 2, estado: 'error', mensaje: stockErr.message }
        } else {
          const { error: stockErr } = await supabase
            .from('stock')
            .insert({
              producto_id: producto.id,
              variante_id: null,
              bodega_id: bodegaId,
              cantidad: stock_actual,
              cantidad_minima: stock_minimo,
            })
          if (stockErr) return { fila: i + 2, estado: 'error', mensaje: stockErr.message }
        }
      }

      return { fila: i + 2, estado: 'ok' }
    }))

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
