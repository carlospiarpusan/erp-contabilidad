import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cajas')
      .select('*')
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
    if (!['admin', 'contador'].includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { nombre, descripcion } = await req.json()
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cajas')
      .insert({ empresa_id: session.empresa_id, nombre, descripcion: descripcion || null })
      .select('id, nombre, descripcion')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
