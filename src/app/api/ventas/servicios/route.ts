import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get('estado')

    const supabase = await createClient()
    let q = supabase
      .from('servicios_tecnicos')
      .select('id, numero, tipo, estado, servicio, direccion, prioridad, fecha_inicio, fecha_promesa, fecha_cierre, observaciones, created_at, cliente:cliente_id(razon_social)', { count: 'exact' })
      .eq('empresa_id', EMPRESA_ID)
      .order('created_at', { ascending: false })
      .limit(100)

    if (estado) q = q.eq('estado', estado)

    const { data, count, error } = await q
    if (error) throw error
    return NextResponse.json({ servicios: data ?? [], total: count ?? 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cliente_id, tipo, servicio, direccion, prioridad = 'normal', fecha_inicio, fecha_promesa, observaciones } = body

    if (!servicio) return NextResponse.json({ error: 'Descripción del servicio requerida' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('servicios_tecnicos')
      .insert({
        empresa_id: EMPRESA_ID,
        cliente_id: cliente_id || null,
        tipo: tipo || 'reparacion',
        servicio,
        direccion: direccion || null,
        prioridad,
        fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_promesa: fecha_promesa || null,
        estado: 'recibida',
        observaciones: observaciones || null,
      })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, estado, observaciones, fecha_cierre } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()
    const updates: Record<string, unknown> = {}
    if (estado       !== undefined) updates.estado       = estado
    if (observaciones !== undefined) updates.observaciones = observaciones
    if (fecha_cierre  !== undefined) updates.fecha_cierre  = fecha_cierre

    const { error } = await supabase.from('servicios_tecnicos').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
