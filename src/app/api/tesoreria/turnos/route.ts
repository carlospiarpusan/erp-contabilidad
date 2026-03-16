import { NextRequest, NextResponse } from 'next/server'
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
      .from('cajas_turnos')
      .select('*, caja:cajas(id,nombre)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha_apertura', { ascending: false })
      .limit(50)
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

    const { caja_id, saldo_apertura } = await req.json()
    if (!caja_id) return NextResponse.json({ error: 'caja_id requerido' }, { status: 400 })
    if (saldo_apertura === undefined || saldo_apertura === null)
      return NextResponse.json({ error: 'saldo_apertura requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('abrir_turno_caja', {
      p_caja_id: caja_id,
      p_saldo_apertura: Number(saldo_apertura),
    })
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { turno_id, saldo_cierre, observaciones } = await req.json()
    if (!turno_id) return NextResponse.json({ error: 'turno_id requerido' }, { status: 400 })
    if (saldo_cierre === undefined || saldo_cierre === null)
      return NextResponse.json({ error: 'saldo_cierre requerido' }, { status: 400 })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('cerrar_turno_caja', {
      p_turno_id: turno_id,
      p_saldo_cierre: Number(saldo_cierre),
      p_observaciones: observaciones || null,
    })
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
