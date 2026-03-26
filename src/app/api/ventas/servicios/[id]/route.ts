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
      .from('servicios_tecnicos')
      .select('*, cliente:cliente_id(id, razon_social, numero_documento, email, telefono)')
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

    const allowed = ['estado', 'prioridad', 'diagnostico', 'solucion', 'observaciones', 'fecha_promesa', 'fecha_cierre']
    const updates: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) updates[k] = body[k]
    }
    // Auto-set fecha_cierre when entregado
    if (body.estado === 'entregado' && !body.fecha_cierre) {
      updates.fecha_cierre = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase.from('servicios_tecnicos').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
