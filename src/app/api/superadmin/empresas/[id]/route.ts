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

function buildEmpresaPayload(body: Record<string, unknown>) {
  return {
    nombre: String(body.nombre ?? '').trim(),
    nit: String(body.nit ?? '').trim(),
    dv: body.dv ? String(body.dv).trim() : null,
    razon_social: body.razon_social ? String(body.razon_social).trim() : null,
    direccion: body.direccion ? String(body.direccion).trim() : null,
    ciudad: body.ciudad ? String(body.ciudad).trim() : null,
    departamento: body.departamento ? String(body.departamento).trim() : null,
    pais: body.pais ? String(body.pais).trim() : null,
    telefono: body.telefono ? String(body.telefono).trim() : null,
    email: body.email ? String(body.email).trim() : null,
    regimen: body.regimen ? String(body.regimen).trim() : null,
    tipo_org: body.tipo_org ? String(body.tipo_org).trim() : null,
    activa: body.activa === undefined ? true : Boolean(body.activa),
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  const session = await requireSuperadmin()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const payload = buildEmpresaPayload(body)

  if (!payload.nombre || !payload.nit) {
    return NextResponse.json({ error: 'Nombre y NIT son requeridos' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin
    .from('empresas')
    .update(payload)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  const session = await requireSuperadmin()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const forceDelete = req.nextUrl.searchParams.get('force') === '1'
  const admin = adminClient()

  const { data: usuarios, error: usuariosError } = await admin
    .from('usuarios')
    .select('id, email')
    .eq('empresa_id', id)

  if (usuariosError) {
    return NextResponse.json({ error: usuariosError.message }, { status: 500 })
  }

  const failedUsers: { id: string; email?: string | null; error: string }[] = []
  const cleanupWarnings: string[] = []

  for (const usuario of usuarios ?? []) {
    const deletion = await deleteUserWithCleanup(admin, String(usuario.id), session.id)
    if (deletion.cleanupErrors.length > 0) {
      cleanupWarnings.push(...deletion.cleanupErrors.map((message) => `${usuario.id}: ${message}`))
    }
    if (!deletion.ok) {
      failedUsers.push({
        id: String(usuario.id),
        email: typeof usuario.email === 'string' ? usuario.email : null,
        error: deletion.error ?? 'No fue posible eliminar el usuario',
      })
    }
  }

  if (failedUsers.length > 0 && !forceDelete) {
    return NextResponse.json(
      {
        error: `No fue posible eliminar ${failedUsers.length} usuario(s) asociados desde Auth. Puedes forzar la eliminación de la empresa y todos sus datos del ERP.`,
        canForceDelete: true,
        failedUsers,
      },
      { status: 409 }
    )
  }

  const { error } = await admin
    .from('empresas')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    forced: forceDelete && failedUsers.length > 0,
    warning: forceDelete && failedUsers.length > 0
      ? `La empresa fue eliminada. ${failedUsers.length} usuario(s) no pudieron borrarse de Auth, pero ya perdieron acceso al ERP.`
      : cleanupWarnings.length > 0
        ? `La empresa fue eliminada. Algunas referencias históricas no se limpiaron automáticamente.`
        : null,
    failedUsers,
    cleanupWarnings,
  })
}
