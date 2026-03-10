import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { updateAsientoManual } from '@/lib/db/contabilidad'
import { registrarAuditoria } from '@/lib/auditoria'
import { toErrorMsg } from '@/lib/utils/errors'

type LineaPayload = {
  cuenta_id: string
  descripcion?: string
  debe: number
  haber: number
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const body = await req.json()

    const payload: {
      fecha?: string
      concepto?: string
      lineas?: LineaPayload[]
    } = {}

    if (body?.fecha !== undefined) payload.fecha = String(body.fecha ?? '')
    if (body?.concepto !== undefined) payload.concepto = String(body.concepto ?? '').trim()
    if (body?.lineas !== undefined) {
      if (!Array.isArray(body.lineas) || body.lineas.length < 2) {
        return NextResponse.json({ error: 'El asiento debe tener al menos 2 líneas' }, { status: 400 })
      }
      payload.lineas = body.lineas.map((l: Record<string, unknown>) => ({
        cuenta_id: String(l.cuenta_id ?? ''),
        descripcion: l.descripcion ? String(l.descripcion) : '',
        debe: Number(l.debe ?? 0),
        haber: Number(l.haber ?? 0),
      }))
    }

    const data = await updateAsientoManual(id, payload)
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'asientos',
      registro_id: id,
      accion: 'UPDATE',
      datos_nuevos: payload,
      ip: req.headers.get('x-forwarded-for'),
    })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
