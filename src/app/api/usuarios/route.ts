import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { getUsuarios, crearUsuario, getRoles } from '@/lib/db/usuarios'
import { getSession } from '@/lib/auth/session'
import { ROLE_IDS } from '@/lib/auth/permissions'
import { z } from 'zod'

const ROLES_USUARIOS_ADMIN = new Set(['admin', 'superadmin'])
const SUPERADMIN_ROLE_ID = ROLE_IDS.superadmin

// IDs de rol permitidos para creación de usuarios tenant
const VALID_TENANT_ROLE_IDS: Set<string> = new Set([
  ROLE_IDS.admin,
  ROLE_IDS.vendedor,
  ROLE_IDS.contador,
  ROLE_IDS.solo_lectura,
])

const crearUsuarioSchema = z.object({
  email: z.string().trim().email('Correo electrónico inválido').max(320),
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  cedula: z.string().trim().min(5, 'Mínimo 5 dígitos').max(20, 'Máximo 20 dígitos')
    .regex(/^\d+$/, 'Solo números'),
  rol_id: z.string().refine(
    (val) => VALID_TENANT_ROLE_IDS.has(val),
    { message: 'Seleccione un rol válido' }
  ),
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
    const msg = toErrorMsg(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireUsersAdmin()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const parsed = crearUsuarioSchema.safeParse(await req.json())
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const details = Object.entries(fieldErrors)
        .map(([field, msgs]) => `${field}: ${(msgs ?? []).join(', ')}`)
        .join('; ')
      return NextResponse.json(
        { error: `Campos inválidos – ${details || 'revise los datos'}` },
        { status: 400 }
      )
    }

    const { email, nombre, rol_id, cedula } = parsed.data
    if (rol_id === SUPERADMIN_ROLE_ID) {
      return NextResponse.json({ error: 'No se puede asignar rol superadmin desde este módulo' }, { status: 403 })
    }

    await crearUsuario(email.toLowerCase(), nombre, rol_id, cedula, session.empresa_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    const msg = toErrorMsg(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
