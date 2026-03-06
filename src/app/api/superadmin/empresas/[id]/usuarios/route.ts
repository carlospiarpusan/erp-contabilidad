import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth/session'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function superadminConfigError() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const admin = adminClient()
  const { data, error } = await admin
    .from('usuarios')
    .select('id, nombre, email, telefono, activo, created_at, rol_id')
    .eq('empresa_id', id)
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id: empresa_id } = await params
  const { email, nombre, rol_id, password } = await req.json()
  if (!email || !nombre || !rol_id) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const admin = adminClient()
  const authRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: password || `Temp${Date.now()}!`,
        email_confirm: true,
        user_metadata: { nombre },
      }),
    }
  )
  if (!authRes.ok) {
    const err = await authRes.json()
    return NextResponse.json({ error: err.msg || err.message }, { status: 500 })
  }
  const { id: userId } = await authRes.json()
  await admin.from('usuarios').upsert(
    { id: userId, empresa_id, rol_id, nombre, email, activo: true },
    { onConflict: 'id' }
  )
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  if (!await requireSuperadmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id: empresa_id } = await params
  const { usuario_id, ...fields } = await req.json()
  if (!usuario_id) return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin
    .from('usuarios')
    .update(fields)
    .eq('id', usuario_id)
    .eq('empresa_id', empresa_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
