import { NextRequest, NextResponse } from 'next/server'
import { updateUsuario } from '@/lib/db/usuarios'
import { getSession } from '@/lib/auth/session'
import { z } from 'zod'

const ROLES_USUARIOS_ADMIN = new Set(['admin', 'superadmin'])
const SUPERADMIN_ROLE_ID = '10000000-0000-0000-0000-000000000005'

const selfPatchSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
}).strict()

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
    const isSelf = session.id === id

    if (isSelf) {
      const parsed = selfPatchSchema.safeParse(rawBody)
      if (!parsed.success || Object.keys(parsed.data).length === 0) {
        return NextResponse.json({ error: 'Solo puedes actualizar nombre o teléfono' }, { status: 400 })
      }

      const updated = await updateUsuario(id, parsed.data)
      return NextResponse.json(updated)
    }

    if (!ROLES_USUARIOS_ADMIN.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const parsed = adminPatchSchema.safeParse(rawBody)
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }

    if (session.rol !== 'superadmin' && parsed.data.rol_id === SUPERADMIN_ROLE_ID) {
      return NextResponse.json({ error: 'No puedes asignar rol superadmin' }, { status: 403 })
    }

    const updated = await updateUsuario(id, parsed.data)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
