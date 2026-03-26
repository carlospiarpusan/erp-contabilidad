import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ROLES = ['admin', 'contador']

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('retenciones')
      .select('*')
      .eq('empresa_id', session.empresa_id)
      .order('tipo')
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
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { tipo, nombre, porcentaje, base_minima, base_uvt, aplica_a } = body
    if (!tipo || !nombre || porcentaje === undefined)
      return NextResponse.json({ error: 'Tipo, nombre y porcentaje son requeridos' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('retenciones')
      .insert({
        empresa_id: session.empresa_id,
        tipo,
        nombre,
        porcentaje: Number(porcentaje),
        base_minima: base_minima ? Number(base_minima) : 0,
        base_uvt: base_uvt ? Number(base_uvt) : null,
        aplica_a: aplica_a || 'compras',
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const allowed = ['nombre', 'porcentaje', 'base_minima', 'base_uvt', 'aplica_a', 'activa']
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in updates) {
        const val = updates[key]
        if (['porcentaje', 'base_minima', 'base_uvt'].includes(key) && val !== null) {
          filtered[key] = Number(val)
        } else {
          filtered[key] = val
        }
      }
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('retenciones')
      .update(filtered)
      .eq('id', id)
      .eq('empresa_id', session.empresa_id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
