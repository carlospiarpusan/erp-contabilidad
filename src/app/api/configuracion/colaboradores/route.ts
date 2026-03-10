import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

async function normalizarUsuarioId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresa_id: string,
  rawUsuarioId: unknown
) {
  const usuario_id = rawUsuarioId ? String(rawUsuarioId) : null
  if (!usuario_id) return null

  const { data, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('id', usuario_id)
    .eq('empresa_id', empresa_id)
    .single()

  if (error || !data) {
    throw new Error('El usuario asignado no pertenece a esta empresa')
  }

  return usuario_id
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nombre, usuario_id, email, telefono, porcentaje_comision, meta_mensual, activo')
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
    const body = await req.json()
    const { nombre, email, telefono, porcentaje_comision, meta_mensual } = body
    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

    const empresa_id = await getEmpresaId()
    const supabase = await createClient()
    const usuario_id = await normalizarUsuarioId(supabase, empresa_id, body?.usuario_id)
    const { data, error } = await supabase
      .from('colaboradores')
      .insert({ empresa_id, nombre: nombre.trim(), usuario_id, email: email || null, telefono: telefono || null,
        porcentaje_comision: parseFloat(porcentaje_comision) || 0,
        meta_mensual: parseFloat(meta_mensual) || 0, activo: true })
      .select('id').single()
    if (error) throw error
    return NextResponse.json({ id: data.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id, ...fields } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const supabase = await createClient()
    const empresa_id = await getEmpresaId()
    const updates: Record<string, unknown> = {}
    if (fields.nombre !== undefined)             updates.nombre = fields.nombre
    if (fields.usuario_id !== undefined)         updates.usuario_id = await normalizarUsuarioId(supabase, empresa_id, fields.usuario_id)
    if (fields.email !== undefined)              updates.email = fields.email || null
    if (fields.telefono !== undefined)           updates.telefono = fields.telefono || null
    if (fields.porcentaje_comision !== undefined) updates.porcentaje_comision = parseFloat(fields.porcentaje_comision) || 0
    if (fields.meta_mensual !== undefined)       updates.meta_mensual = parseFloat(fields.meta_mensual) || 0
    if (fields.activo !== undefined)             updates.activo = fields.activo
    const { error } = await supabase.from('colaboradores').update(updates).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('colaboradores').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
