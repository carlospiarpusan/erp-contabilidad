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

export async function GET() {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  if (!await requireSuperadmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const admin = adminClient()
  const { data, error } = await admin
    .from('empresas')
    .select('id, nombre, nit, ciudad, activa, created_at')
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const configErr = superadminConfigError()
  if (configErr) return configErr
  if (!await requireSuperadmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const body = await req.json()
  const { nombre, nit, email_admin, nombre_admin, password_admin } = body

  if (!nombre || !nit || !email_admin || !nombre_admin || !password_admin) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const admin = adminClient()

  // 1. Crear empresa
  const { data: empresa, error: eEmp } = await admin
    .from('empresas')
    .insert({ nombre, nit, activa: true })
    .select('id')
    .single()
  if (eEmp) return NextResponse.json({ error: eEmp.message }, { status: 500 })

  // 2. Crear usuario admin en auth
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
        email: email_admin,
        password: password_admin,
        email_confirm: true,
        user_metadata: { nombre: nombre_admin },
      }),
    }
  )
  if (!authRes.ok) {
    const err = await authRes.json()
    // Rollback empresa
    await admin.from('empresas').delete().eq('id', empresa.id)
    return NextResponse.json({ error: err.msg || err.message }, { status: 500 })
  }

  const { id: userId } = await authRes.json()

  // 3. Insertar en tabla usuarios con rol admin
  await admin.from('usuarios').upsert({
    id: userId,
    empresa_id: empresa.id,
    rol_id: '10000000-0000-0000-0000-000000000001', // admin
    nombre: nombre_admin,
    email: email_admin,
    activo: true,
  }, { onConflict: 'id' })

  return NextResponse.json({ ok: true, empresa_id: empresa.id }, { status: 201 })
}
