import { NextRequest, NextResponse } from 'next/server'
import { getEjerciciosAll, createEjercicio } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'


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

export async function GET() {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const data = await getEjerciciosAll()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const body = await req.json()
    const anio = Number(body?.año)
    const fecha_inicio = String(body?.fecha_inicio ?? '')
    const fecha_fin = String(body?.fecha_fin ?? '')
    const descripcion = typeof body?.descripcion === 'string' ? body.descripcion : ''

    if (!anio || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ error: 'año, fecha_inicio y fecha_fin requeridos' }, { status: 400 })
    }
    if (fecha_inicio > fecha_fin) {
      return NextResponse.json({ error: 'fecha_inicio no puede ser mayor a fecha_fin' }, { status: 400 })
    }

    const payload = { año: anio, fecha_inicio, fecha_fin, descripcion: descripcion || undefined }
    const data = await createEjercicio(payload)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
