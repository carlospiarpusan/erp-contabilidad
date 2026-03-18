import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth/session'
import { updatePerfilPropio } from '@/lib/db/usuarios'

const perfilPatchSchema = z.object({
  nombre: z.string().trim().min(2).max(120).optional(),
  telefono: z.string().trim().max(30).nullable().optional(),
}).strict()

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rawBody: unknown = await req.json()
    const parsed = perfilPatchSchema.safeParse(rawBody)

    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'Solo puedes actualizar nombre o teléfono' }, { status: 400 })
    }

    const updated = await updatePerfilPropio(session.id, parsed.data)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
