import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { updateUsuario } from '@/lib/db/usuarios'
import { getSession } from '@/lib/auth/session'
import { ROLE_IDS } from '@/lib/auth/permissions'
import { z } from 'zod'

const ROLES_USUARIOS_ADMIN = new Set(['admin'])
const SUPERADMIN_ROLE_ID = ROLE_IDS.superadmin

const adminPatchSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
  rol_id: z.string().uuid().optional(),
  activo: z.boolean().optional(),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const rawBody: unknown = await req.json()

    if (!ROLES_USUARIOS_ADMIN.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const parsed = adminPatchSchema.safeParse(rawBody)
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    if (parsed.data.rol_id === SUPERADMIN_ROLE_ID) {
      return NextResponse.json({ error: 'No puedes asignar rol superadmin' }, { status: 403 })
    }

    const updated = await updateUsuario(id, parsed.data)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const msg = toErrorMsg(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
