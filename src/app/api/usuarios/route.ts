import { NextRequest, NextResponse } from 'next/server'
import { getUsuarios, invitarUsuario, getRoles } from '@/lib/db/usuarios'
import { getSession } from '@/lib/auth/session'
import { z } from 'zod'

const ROLES_USUARIOS_ADMIN = new Set(['admin', 'superadmin'])
const SUPERADMIN_ROLE_ID = '10000000-0000-0000-0000-000000000005'

const crearUsuarioSchema = z.object({
  email: z.string().trim().email().max(320),
  nombre: z.string().trim().min(2).max(120),
  rol_id: z.string().uuid(),
})

async function requireUsersAdmin() {
  const session = await getSession()
  if (!session || !ROLES_USUARIOS_ADMIN.has(session.rol)) return null
  return session
}

export async function GET() {
  try {
    if (!await requireUsersAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const [usuarios, roles] = await Promise.all([getUsuarios(), getRoles()])
    return NextResponse.json({ usuarios, roles })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await requireUsersAdmin()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const parsed = crearUsuarioSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Campos inválidos: email, nombre, rol_id' }, { status: 400 })
    }

    const { email, nombre, rol_id } = parsed.data
    if (rol_id === SUPERADMIN_ROLE_ID) {
      return NextResponse.json({ error: 'No se puede asignar rol superadmin desde este módulo' }, { status: 403 })
    }

    await invitarUsuario(email.toLowerCase(), nombre, rol_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
