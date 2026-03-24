import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { hasSupabaseServiceEnv } from '@/lib/supabase/config'
import { deleteUserWithCleanup } from '@/lib/db/superadmin'

function adminClient() {
  return createServiceClient()
}

function superadminConfigError() {
  if (!hasSupabaseServiceEnv()) {
    return NextResponse.json(
      { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno' },
      { status: 500 }
    )
  }
  return null
}

async function requireSuperadmin() {
  const session = await getSession()
  if (!session || session.rol !== 'superadmin') return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const admin = adminClient()

  if (id === session.id && body.activo === false) {
    return NextResponse.json({ error: 'No puedes desactivarte a ti mismo desde este panel' }, { status: 400 })
  }

  const authPayload: Record<string, unknown> = {}
  if (body.email) authPayload.email = String(body.email).trim()
  if (body.password) authPayload.password = String(body.password)
  if (body.nombre) authPayload.user_metadata = { nombre: String(body.nombre).trim() }

  if (Object.keys(authPayload).length > 0) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, authPayload)
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const payload = {
    ...(body.nombre !== undefined ? { nombre: String(body.nombre).trim() } : {}),
    ...(body.email !== undefined ? { email: String(body.email).trim() } : {}),
    ...(body.telefono !== undefined ? { telefono: body.telefono ? String(body.telefono).trim() : null } : {}),
    ...(body.empresa_id !== undefined ? { empresa_id: String(body.empresa_id) } : {}),
    ...(body.rol_id !== undefined ? { rol_id: String(body.rol_id) } : {}),
    ...(body.activo !== undefined ? { activo: Boolean(body.activo) } : {}),
    ...(body.password ? { debe_cambiar_password: true } : {}),
  }

  const { error } = await admin
    .from('usuarios')
    .update(payload)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  const session = await requireSuperadmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const forceDelete = req.nextUrl.searchParams.get('force') === '1'
  if (id === session.id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio usuario desde este panel' }, { status: 400 })
  }

  const admin = adminClient()
  const deletion = await deleteUserWithCleanup(admin, id, session.id)
  if (deletion.ok) {
    return NextResponse.json({
      ok: true,
      warning: deletion.cleanupErrors.length > 0
        ? `El usuario fue eliminado. Algunas referencias históricas no se limpiaron automáticamente: ${deletion.cleanupErrors.join(' | ')}`
        : null,
    })
  }

  if (!forceDelete) {
    return NextResponse.json(
      {
        error: `No fue posible eliminar el usuario desde Auth: ${deletion.error}`,
        canForceDelete: true,
        cleanupErrors: deletion.cleanupErrors,
      },
      { status: 409 }
    )
  }

  const { error: publicDeleteError } = await admin
    .from('usuarios')
    .delete()
    .eq('id', id)

  if (publicDeleteError) {
    return NextResponse.json({ error: publicDeleteError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    forced: true,
    warning: 'El usuario fue eliminado del ERP, pero no se pudo borrar de Auth.',
  })
}
