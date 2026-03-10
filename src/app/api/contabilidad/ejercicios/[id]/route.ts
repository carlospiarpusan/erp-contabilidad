import { NextRequest, NextResponse } from 'next/server'
import { updateEjercicio } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

interface Ctx { params: Promise<{ id: string }> }


async function requireContabilidadAccess() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!puedeAcceder(session.rol, 'contabilidad')) {
    return NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 })
  }
  return null
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const { id } = await params
    const body = await req.json()
    const payload: Partial<{ año: number; descripcion: string; fecha_inicio: string; fecha_fin: string; estado: string }> = {}

    if (body?.año !== undefined) payload.año = Number(body.año)
    if (body?.descripcion !== undefined) payload.descripcion = String(body.descripcion)
    if (body?.fecha_inicio !== undefined) payload.fecha_inicio = String(body.fecha_inicio)
    if (body?.fecha_fin !== undefined) payload.fecha_fin = String(body.fecha_fin)
    if (body?.estado !== undefined) payload.estado = String(body.estado)

    if (payload.fecha_inicio && payload.fecha_fin && payload.fecha_inicio > payload.fecha_fin) {
      return NextResponse.json({ error: 'fecha_inicio no puede ser mayor a fecha_fin' }, { status: 400 })
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    const data = await updateEjercicio(id, payload)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
