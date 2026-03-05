import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const desde  = searchParams.get('desde')
    const hasta  = searchParams.get('hasta')

    const supabase = await createClient()
    let q = supabase
      .from('garantias')
      .select('id, numero, estado, prioridad, numero_serie, numero_rma, fecha_venta, observaciones, created_at, cliente:cliente_id(razon_social), producto:producto_id(descripcion, codigo), documento:documento_venta_id(prefijo, numero)', { count: 'exact' })
      .eq('empresa_id', EMPRESA_ID)
      .order('created_at', { ascending: false })
      .limit(100)

    if (estado) q = q.eq('estado', estado)
    if (desde)  q = q.gte('fecha_venta', desde)
    if (hasta)  q = q.lte('fecha_venta', hasta)

    const { data, count, error } = await q
    if (error) throw error
    return NextResponse.json({ garantias: data ?? [], total: count ?? 0 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cliente_id, producto_id, numero_serie, numero_rma, fecha_venta, observaciones, prioridad = 'normal', documento_venta_id } = body

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('garantias')
      .insert({
        empresa_id: EMPRESA_ID,
        cliente_id: cliente_id || null,
        producto_id: producto_id || null,
        numero_serie: numero_serie || null,
        numero_rma: numero_rma || null,
        fecha_venta: fecha_venta || null,
        estado: 'pendiente',
        prioridad,
        observaciones: observaciones || null,
        documento_venta_id: documento_venta_id || null,
      })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, estado, observaciones } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()
    const updates: Record<string, unknown> = {}
    if (estado       !== undefined) updates.estado       = estado
    if (observaciones !== undefined) updates.observaciones = observaciones

    const { error } = await supabase.from('garantias').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
