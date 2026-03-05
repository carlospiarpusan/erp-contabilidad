import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transportadoras')
      .select('id, nombre, whatsapp, url_rastreo, activa')
      .eq('empresa_id', EMPRESA_ID)
      .order('nombre')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, whatsapp, url_rastreo } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transportadoras')
      .insert({
        empresa_id: EMPRESA_ID,
        nombre,
        whatsapp: whatsapp || null,
        url_rastreo: url_rastreo || null,
        activa: true,
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, nombre, whatsapp, url_rastreo, activa } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined)      updates.nombre      = nombre
    if (whatsapp !== undefined)    updates.whatsapp    = whatsapp || null
    if (url_rastreo !== undefined) updates.url_rastreo = url_rastreo || null
    if (activa !== undefined)      updates.activa      = activa

    const { error } = await supabase.from('transportadoras').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
