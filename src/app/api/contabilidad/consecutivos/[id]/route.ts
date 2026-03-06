import { NextRequest, NextResponse } from 'next/server'
import { updateConsecutivo } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'

interface Ctx { params: Promise<{ id: string }> }

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Error'
}

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
    const payload: Partial<{ prefijo: string; consecutivo_actual: number; activo: boolean; descripcion: string }> = {}

    if (body?.prefijo !== undefined) payload.prefijo = String(body.prefijo)
    if (body?.consecutivo_actual !== undefined) payload.consecutivo_actual = Number(body.consecutivo_actual)
    if (body?.activo !== undefined) payload.activo = Boolean(body.activo)
    if (body?.descripcion !== undefined) payload.descripcion = String(body.descripcion)

    if (payload.consecutivo_actual !== undefined && (Number.isNaN(payload.consecutivo_actual) || payload.consecutivo_actual < 0)) {
      return NextResponse.json({ error: 'consecutivo_actual inválido' }, { status: 400 })
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    const data = await updateConsecutivo(id, payload)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
