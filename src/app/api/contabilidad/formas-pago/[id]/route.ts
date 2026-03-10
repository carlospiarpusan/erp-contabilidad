import { NextRequest, NextResponse } from 'next/server'
import { updateFormaPago, deleteFormaPago } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

interface Ctx { params: Promise<{ id: string }> }
const TIPOS_FORMA_PAGO = new Set(['contado', 'credito', 'anticipo', 'anticipado'])


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
    const payload: Partial<{
      descripcion: string
      tipo: string
      dias_vencimiento: number
      cuenta_id: string | null
      activo: boolean
      genera_factura: boolean
    }> = {}

    if (body?.descripcion !== undefined) payload.descripcion = String(body.descripcion).trim()
    if (body?.tipo !== undefined) payload.tipo = String(body.tipo).trim()
    if (body?.dias_vencimiento !== undefined) payload.dias_vencimiento = Number(body.dias_vencimiento)
    if (body?.cuenta_id !== undefined) payload.cuenta_id = body.cuenta_id
    if (body?.activo !== undefined) payload.activo = Boolean(body.activo)
    if (body?.genera_factura !== undefined) payload.genera_factura = Boolean(body.genera_factura)

    if (payload.dias_vencimiento !== undefined && (Number.isNaN(payload.dias_vencimiento) || payload.dias_vencimiento < 0)) {
      return NextResponse.json({ error: 'dias_vencimiento inválido' }, { status: 400 })
    }
    if (payload.tipo !== undefined && !TIPOS_FORMA_PAGO.has(payload.tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    const data = await updateFormaPago(id, payload)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const { id } = await params
    await deleteFormaPago(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
