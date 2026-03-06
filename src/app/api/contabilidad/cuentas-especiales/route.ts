import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Error'
}

async function requireContabilidadAccess() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!puedeAcceder(session.rol, 'contabilidad')) {
    return NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 })
  }
  return null
}

export async function GET() {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cuentas_especiales')
      .select('id, tipo, cuenta_id, cuentas_puc(codigo, descripcion)')
      .order('tipo')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const { tipo, cuenta_id } = await req.json()
    if (!tipo || !cuenta_id) return NextResponse.json({ error: 'tipo y cuenta_id requeridos' }, { status: 400 })

    const empresa_id = await getEmpresaId()
    const supabase = await createClient()

    // Upsert: si existe el tipo, actualiza; si no, inserta
    const { error } = await supabase
      .from('cuentas_especiales')
      .upsert({ empresa_id, tipo, cuenta_id }, { onConflict: 'empresa_id,tipo' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
