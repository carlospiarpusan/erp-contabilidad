import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { updatePeriodoContable } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

interface Context {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'contabilidad', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const estado = String(body?.estado ?? '')
    if (!['abierto', 'cerrado', 'reabierto'].includes(estado)) {
      return NextResponse.json({ error: 'Estado de periodo inválido' }, { status: 400 })
    }
    const data = await updatePeriodoContable(id, {
      estado: estado as 'abierto' | 'cerrado' | 'reabierto',
      motivo: typeof body?.motivo === 'string' ? body.motivo : null,
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
