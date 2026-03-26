import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transportadoras')
      .select('id, nombre, whatsapp, url_rastreo, activa')
      .eq('empresa_id', session.empresa_id)
      .order('nombre')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { nombre, whatsapp, url_rastreo } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('transportadoras')
      .insert({
        empresa_id: session.empresa_id,
        nombre,
        whatsapp: whatsapp || null,
        url_rastreo: url_rastreo || null,
        activa: true,
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id, nombre, whatsapp, url_rastreo, activa } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined)      updates.nombre      = nombre
    if (whatsapp !== undefined)    updates.whatsapp    = whatsapp || null
    if (url_rastreo !== undefined) updates.url_rastreo = url_rastreo || null
    if (activa !== undefined)      updates.activa      = activa

    const { error } = await supabase.from('transportadoras').update(updates).eq('id', id).eq('empresa_id', session.empresa_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
