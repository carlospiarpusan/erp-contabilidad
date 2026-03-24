import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { ensurePeriodoAbierto } from '@/lib/db/compliance'

const ROLES = ['admin', 'contador']

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const cuenta_id = searchParams.get('cuenta_id')
    if (!cuenta_id) return NextResponse.json({ error: 'cuenta_id requerido' }, { status: 400 })

    const supabase = await createClient()
    let query = supabase
      .from('movimientos_bancarios')
      .select('*')
      .eq('cuenta_bancaria_id', cuenta_id)
      .eq('empresa_id', session.empresa_id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)

    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')
    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)

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
    const { cuenta_bancaria_id, tipo, concepto, monto, referencia, descripcion } = body
    if (!cuenta_bancaria_id || !tipo || !concepto || !monto)
      return NextResponse.json({ error: 'Campos requeridos: cuenta, tipo, concepto, monto' }, { status: 400 })

    const fecha = typeof body?.fecha === 'string' && body.fecha ? body.fecha : new Date().toISOString().split('T')[0]
    await ensurePeriodoAbierto({
      session,
      fecha,
      source: 'api:movimientos-bancarios',
      method: req.method,
      route: '/api/tesoreria/movimientos-bancarios',
      context: { cuenta_bancaria_id, tipo, concepto },
    })

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('registrar_movimiento_bancario', {
      p_cuenta_id: cuenta_bancaria_id,
      p_tipo: tipo,
      p_concepto: concepto,
      p_monto: Number(monto),
      p_referencia: referencia || null,
      p_descripcion: descripcion || null,
      p_documento_id: null,
    })
    if (error) throw error
    return NextResponse.json({ id: data }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
