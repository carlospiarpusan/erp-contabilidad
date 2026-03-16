import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const turno_id = searchParams.get('turno_id')
    if (!turno_id) return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cajas_movimientos')
      .select('*')
      .eq('turno_id', turno_id)
      .eq('empresa_id', session.empresa_id)
      .order('created_at')
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
    if (!['admin', 'contador'].includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { turno_id, tipo, concepto, monto, descripcion } = await req.json()
    if (!turno_id) return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
    if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })
    if (!concepto) return NextResponse.json({ error: 'concepto requerido' }, { status: 400 })
    if (!monto || monto <= 0) return NextResponse.json({ error: 'monto debe ser > 0' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cajas_movimientos')
      .insert({
        empresa_id: session.empresa_id,
        turno_id,
        tipo,
        concepto,
        monto: Number(monto),
        descripcion: descripcion || null,
        created_by: session.id,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
