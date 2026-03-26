import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveRoleById } from '@/lib/auth/permissions'
import { toErrorMsg } from '@/lib/utils/errors'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { empresa_id } = await req.json()
    if (!empresa_id || typeof empresa_id !== 'string') {
      return NextResponse.json({ error: 'empresa_id es requerido' }, { status: 400 })
    }

    const service = createServiceClient()

    // Verify user has access to this empresa
    const { data: membership, error: memErr } = await service
      .from('usuario_empresas')
      .select('empresa_id, rol_id, empresas(nombre)')
      .eq('usuario_id', session.id)
      .eq('empresa_id', empresa_id)
      .eq('activo', true)
      .single()

    if (memErr || !membership) {
      return NextResponse.json({ error: 'No tienes acceso a esta empresa' }, { status: 403 })
    }

    const rol = resolveRoleById(membership.rol_id)
    if (!rol) {
      return NextResponse.json({ error: 'Rol no válido para esta empresa' }, { status: 400 })
    }

    // Switch: update usuarios.empresa_id and rol_id
    const { error: updErr } = await service
      .from('usuarios')
      .update({
        empresa_id,
        rol_id: membership.rol_id,
      })
      .eq('id', session.id)

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    const empresas = membership.empresas as { nombre: string } | { nombre: string }[] | null
    const empresaNombre = Array.isArray(empresas) ? empresas[0]?.nombre : empresas?.nombre

    return NextResponse.json({
      ok: true,
      empresa_id,
      empresa_nombre: empresaNombre ?? '',
      rol,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
