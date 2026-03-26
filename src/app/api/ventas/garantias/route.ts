import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')
    const desde  = searchParams.get('desde')
    const hasta  = searchParams.get('hasta')

    const supabase = await createClient()
    let q = supabase
      .from('garantias')
      .select('id, numero, estado, prioridad, numero_serie, numero_rma, fecha_venta, observaciones, created_at, cliente:cliente_id(razon_social), producto:producto_id(descripcion, codigo), documento:documento_venta_id(prefijo, numero)', { count: 'exact' })
      .eq('empresa_id', session.empresa_id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (estado) q = q.eq('estado', estado)
    if (desde)  q = q.gte('fecha_venta', desde)
    if (hasta)  q = q.lte('fecha_venta', hasta)

    const { data, count, error } = await q
    if (error) throw error
    return NextResponse.json({ garantias: data ?? [], total: count ?? 0 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { cliente_id, producto_id, numero_serie, numero_rma, fecha_venta, observaciones, prioridad = 'normal', documento_venta_id } = body

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('garantias')
      .insert({
        empresa_id: session.empresa_id,
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
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id, estado, observaciones } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()
    const updates: Record<string, unknown> = {}
    if (estado       !== undefined) updates.estado       = estado
    if (observaciones !== undefined) updates.observaciones = observaciones

    const { error } = await supabase.from('garantias').update(updates).eq('id', id).eq('empresa_id', session.empresa_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
