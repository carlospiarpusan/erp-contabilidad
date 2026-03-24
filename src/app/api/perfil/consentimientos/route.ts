import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { getRegulatoryConfig } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const supabase = await createClient()
    const [config, consentRes] = await Promise.all([
      getRegulatoryConfig(),
      supabase
        .from('consentimientos_privacidad')
        .select('id, tipo, version, aceptado_en')
        .eq('usuario_id', session.id)
        .order('aceptado_en', { ascending: false })
        .limit(20),
    ])

    if (consentRes.error) throw consentRes.error
    return NextResponse.json({
      politica_actual: config.politica_datos_version ?? null,
      consentimientos: consentRes.data ?? [],
    })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const config = await getRegulatoryConfig()
    const version = String(body?.version ?? config.politica_datos_version ?? '').trim()
    if (!version) {
      return NextResponse.json({ error: 'No hay versión de política configurada para registrar.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('consentimientos_privacidad')
      .insert({
        empresa_id: session.empresa_id,
        usuario_id: session.id,
        tipo: 'politica_datos',
        version,
        ip: req.headers.get('x-forwarded-for'),
        user_agent: req.headers.get('user-agent'),
      })
      .select('id, tipo, version, aceptado_en')
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
