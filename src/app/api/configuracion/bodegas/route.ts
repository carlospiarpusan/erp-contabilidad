import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bodegas')
      .select('id, codigo, nombre, principal, activa')
      .eq('empresa_id', session.empresa_id)
      .order('nombre')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { codigo, nombre, principal = false } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const supabase = await createClient()

    // If setting as principal, clear others first
    if (principal) {
      await supabase.from('bodegas').update({ principal: false }).eq('empresa_id', session.empresa_id)
    }

    const { data, error } = await supabase
      .from('bodegas')
      .insert({ empresa_id: session.empresa_id, codigo: codigo || null, nombre, principal, activa: true })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id, codigo, nombre, principal, activa } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()

    if (principal) {
      await supabase.from('bodegas').update({ principal: false }).eq('empresa_id', session.empresa_id)
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined)    updates.nombre    = nombre
    if (codigo !== undefined)    updates.codigo    = codigo || null
    if (principal !== undefined) updates.principal = principal
    if (activa !== undefined)    updates.activa    = activa

    const { error } = await supabase.from('bodegas').update(updates).eq('id', id).eq('empresa_id', session.empresa_id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
