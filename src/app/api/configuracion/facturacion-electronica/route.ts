import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { testDataicoConnection } from '@/lib/dataico/client'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const supabase = await createClient()
    const { data } = await supabase
      .from('configuracion_fe')
      .select('*')
      .eq('empresa_id', session.empresa_id)
      .maybeSingle()

    return NextResponse.json(data ?? null)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const allowed = [
      'activa', 'ambiente', 'auth_token', 'account_id',
      'prefijo', 'resolucion', 'fecha_resolucion',
      'rango_desde', 'rango_hasta',
      'send_dian', 'send_email', 'email_copia',
    ]

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    const supabase = await createClient()

    // Upsert — create if not exists
    const { data: existing } = await supabase
      .from('configuracion_fe')
      .select('id')
      .eq('empresa_id', session.empresa_id)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('configuracion_fe')
        .update(updates)
        .eq('empresa_id', session.empresa_id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('configuracion_fe')
        .insert({ empresa_id: session.empresa_id, ...updates })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { action } = await req.json()

    if (action === 'test') {
      const supabase = await createClient()
      const { data } = await supabase
        .from('configuracion_fe')
        .select('auth_token, account_id, ambiente')
        .eq('empresa_id', session.empresa_id)
        .maybeSingle()

      if (!data?.auth_token || !data?.account_id) {
        return NextResponse.json({ ok: false, message: 'Configura el Auth Token y Account ID primero' })
      }

      const result = await testDataicoConnection({
        auth_token: data.auth_token,
        account_id: data.account_id,
        ambiente: data.ambiente ?? 'pruebas',
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
