import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

interface Params { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('garantias')
      .select('*, cliente:cliente_id(id, razon_social, numero_documento, email, telefono), producto:producto_id(id, codigo, descripcion), documento:documento_venta_id(id, prefijo, numero)')
      .eq('id', id).single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const supabase = await createClient()

    const allowed = ['estado', 'prioridad', 'observaciones', 'numero_rma']
    const updates: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) updates[k] = body[k]
    }

    const { error } = await supabase.from('garantias').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
