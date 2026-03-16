import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ROLES = ['admin', 'contador']

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const cuenta_id = searchParams.get('cuenta_id')

    const supabase = await createClient()
    let query = supabase
      .from('conciliaciones_bancarias')
      .select('*, cuenta:cuentas_bancarias(id,nombre,banco)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha_fin', { ascending: false })

    if (cuenta_id) query = query.eq('cuenta_bancaria_id', cuenta_id)

    const { data, error } = await query
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
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { cuenta_bancaria_id, fecha_inicio, fecha_fin, saldo_extracto, observaciones } = body
    if (!cuenta_bancaria_id || !fecha_inicio || !fecha_fin || saldo_extracto === undefined)
      return NextResponse.json({ error: 'Cuenta, fechas y saldo de extracto son requeridos' }, { status: 400 })

    const supabase = await createClient()

    // Calculate book balance from movimientos_bancarios in the date range
    const { data: cuenta } = await supabase
      .from('cuentas_bancarias')
      .select('saldo_actual')
      .eq('id', cuenta_bancaria_id)
      .single()

    const saldo_libros = cuenta?.saldo_actual ?? 0
    const diferencia = Number(saldo_extracto) - saldo_libros

    const { data, error } = await supabase
      .from('conciliaciones_bancarias')
      .insert({
        empresa_id: session.empresa_id,
        cuenta_bancaria_id,
        fecha_inicio,
        fecha_fin,
        saldo_extracto: Number(saldo_extracto),
        saldo_libros,
        diferencia,
        observaciones: observaciones || null,
        created_by: session.id,
      })
      .select('*, cuenta:cuentas_bancarias(id,nombre,banco)')
      .single()
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
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { id, estado, saldo_extracto, observaciones } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (estado) updates.estado = estado
    if (saldo_extracto !== undefined) {
      updates.saldo_extracto = Number(saldo_extracto)
    }
    if (observaciones !== undefined) updates.observaciones = observaciones

    const supabase = await createClient()

    if (estado === 'conciliada') {
      // Mark all movimientos in date range as conciliado
      const { data: conc } = await supabase
        .from('conciliaciones_bancarias')
        .select('cuenta_bancaria_id, fecha_inicio, fecha_fin')
        .eq('id', id)
        .single()

      if (conc) {
        await supabase
          .from('movimientos_bancarios')
          .update({ conciliado: true })
          .eq('cuenta_bancaria_id', conc.cuenta_bancaria_id)
          .eq('empresa_id', session.empresa_id)
          .gte('fecha', conc.fecha_inicio)
          .lte('fecha', conc.fecha_fin)
      }
    }

    const { data, error } = await supabase
      .from('conciliaciones_bancarias')
      .update(updates)
      .eq('id', id)
      .eq('empresa_id', session.empresa_id)
      .select('*, cuenta:cuentas_bancarias(id,nombre,banco)')
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
