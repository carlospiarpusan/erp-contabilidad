import { NextRequest, NextResponse } from 'next/server'
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
      .from('cuentas_bancarias')
      .select('*')
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
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { nombre, banco, tipo_cuenta, numero_cuenta, titular, saldo_inicial } = body
    if (!nombre || !banco || !numero_cuenta)
      return NextResponse.json({ error: 'Nombre, banco y número de cuenta son requeridos' }, { status: 400 })

    const saldo = Number(saldo_inicial) || 0

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cuentas_bancarias')
      .insert({
        empresa_id: session.empresa_id,
        nombre,
        banco,
        tipo_cuenta: tipo_cuenta || 'ahorros',
        numero_cuenta,
        titular: titular || null,
        saldo_inicial: saldo,
        saldo_actual: saldo,
      })
      .select()
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
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const allowed = ['nombre', 'banco', 'tipo_cuenta', 'numero_cuenta', 'titular', 'activa']
    const filtered: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in updates) filtered[key] = updates[key]
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cuentas_bancarias')
      .update(filtered)
      .eq('id', id)
      .eq('empresa_id', session.empresa_id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
