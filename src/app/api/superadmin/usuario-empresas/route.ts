import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { toErrorMsg } from '@/lib/utils/errors'

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') return null
  return session
}

// GET ?usuario_id=X — listar empresas asignadas a un usuario
export async function GET(req: NextRequest) {
  try {
    if (!await requireSuperadmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const usuarioId = req.nextUrl.searchParams.get('usuario_id')
    if (!usuarioId) {
      return NextResponse.json({ error: 'usuario_id es requerido' }, { status: 400 })
    }

    const admin = createServiceClient()
    const { data, error } = await admin
      .from('usuario_empresas')
      .select('id, empresa_id, rol_id, es_principal, activo, empresas(nombre, nit), roles(nombre)')
      .eq('usuario_id', usuarioId)
      .order('es_principal', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

// POST { usuario_id, empresa_id, rol_id } — asignar empresa a usuario
export async function POST(req: NextRequest) {
  try {
    if (!await requireSuperadmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { usuario_id, empresa_id, rol_id } = await req.json()
    if (!usuario_id || !empresa_id || !rol_id) {
      return NextResponse.json({ error: 'usuario_id, empresa_id y rol_id son requeridos' }, { status: 400 })
    }

    const admin = createServiceClient()

    // Verify empresa exists
    const { data: empresa } = await admin
      .from('empresas')
      .select('id')
      .eq('id', empresa_id)
      .single()
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
    }

    // Verify rol exists
    const { data: rol } = await admin
      .from('roles')
      .select('id')
      .eq('id', rol_id)
      .single()
    if (!rol) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
    }

    // Check if it's the first membership for this user
    const { count } = await admin
      .from('usuario_empresas')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_id', usuario_id)
      .eq('activo', true)

    const esPrimera = (count ?? 0) === 0

    const { error } = await admin
      .from('usuario_empresas')
      .upsert({
        usuario_id,
        empresa_id,
        rol_id,
        es_principal: esPrimera,
        activo: true,
      }, { onConflict: 'usuario_id,empresa_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

// DELETE { usuario_id, empresa_id } — desactivar acceso a empresa
export async function DELETE(req: NextRequest) {
  try {
    if (!await requireSuperadmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { usuario_id, empresa_id } = await req.json()
    if (!usuario_id || !empresa_id) {
      return NextResponse.json({ error: 'usuario_id y empresa_id son requeridos' }, { status: 400 })
    }

    const admin = createServiceClient()

    // Don't allow removing the principal if it's the only active one
    const { data: membership } = await admin
      .from('usuario_empresas')
      .select('es_principal')
      .eq('usuario_id', usuario_id)
      .eq('empresa_id', empresa_id)
      .eq('activo', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Membresía no encontrada' }, { status: 404 })
    }

    if (membership.es_principal) {
      const { count } = await admin
        .from('usuario_empresas')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', usuario_id)
        .eq('activo', true)
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'No se puede quitar la única empresa del usuario' },
          { status: 400 }
        )
      }
    }

    const { error } = await admin
      .from('usuario_empresas')
      .update({ activo: false })
      .eq('usuario_id', usuario_id)
      .eq('empresa_id', empresa_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
