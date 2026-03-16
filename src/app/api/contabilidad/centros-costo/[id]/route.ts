import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

interface Ctx { params: Promise<{ id: string }> }

const CAMPOS_EDITABLES = ['codigo', 'nombre', 'descripcion', 'activo']

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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { err } = await requireAccess()
    if (err) return err

    const { id } = await params
    const body = await req.json()
    const filtered = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    )

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('centros_costo')
      .update(filtered)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { err } = await requireAccess()
    if (err) return err

    const { id } = await params

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('centros_costo')
      .update({ activo: false })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
