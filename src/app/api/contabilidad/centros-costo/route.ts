import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

async function requireAccess() {
  const session = await getSession()
  if (!session) {
    return { err: NextResponse.json({ error: 'No autorizado' }, { status: 401 }), session: null }
  }
  if (!puedeAcceder(session.rol, 'contabilidad')) {
    return { err: NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 }), session: null }
  }
  return { err: null, session }
}

export async function GET() {
  try {
    const { err, session } = await requireAccess()
    if (err) return err

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('centros_costo')
      .select('*')
      .eq('empresa_id', session!.empresa_id)
      .order('codigo')

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { err, session } = await requireAccess()
    if (err) return err

    const body = await req.json()

    const codigo = String(body?.codigo ?? '').trim().toUpperCase()
    const nombre = String(body?.nombre ?? '').trim()
    const descripcion = String(body?.descripcion ?? '').trim()

    if (!codigo || !nombre) {
      return NextResponse.json({ error: 'codigo y nombre son requeridos' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('centros_costo')
      .insert({
        codigo,
        nombre,
        descripcion: descripcion || null,
        empresa_id: session!.empresa_id,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
