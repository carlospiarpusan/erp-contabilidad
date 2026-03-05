import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('bodegas')
      .select('id, codigo, nombre, principal, activa')
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
    const { codigo, nombre, principal = false } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const supabase = await createClient()

    // If setting as principal, clear others first
    if (principal) {
      await supabase.from('bodegas').update({ principal: false }).eq('empresa_id', EMPRESA_ID)
    }

    const { data, error } = await supabase
      .from('bodegas')
      .insert({ empresa_id: EMPRESA_ID, codigo: codigo || null, nombre, principal, activa: true })
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
    const { id, codigo, nombre, principal, activa } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const supabase = await createClient()

    if (principal) {
      await supabase.from('bodegas').update({ principal: false }).eq('empresa_id', EMPRESA_ID)
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined)    updates.nombre    = nombre
    if (codigo !== undefined)    updates.codigo    = codigo || null
    if (principal !== undefined) updates.principal = principal
    if (activa !== undefined)    updates.activa    = activa

    const { error } = await supabase.from('bodegas').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
