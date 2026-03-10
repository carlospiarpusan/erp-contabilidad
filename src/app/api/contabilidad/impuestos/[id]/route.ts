import { NextRequest, NextResponse } from 'next/server'
import { updateImpuesto, deleteImpuesto } from '@/lib/db/contabilidad'
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
    const payload: Partial<{
      codigo: string
      descripcion: string
      porcentaje: number
      porcentaje_recargo: number
      subcuenta_compras_id: string | null
      subcuenta_ventas_id: string | null
      por_defecto: boolean
    }> = {}

    if (body?.codigo !== undefined) payload.codigo = String(body.codigo).trim().toUpperCase()
    if (body?.descripcion !== undefined || body?.nombre !== undefined) {
      payload.descripcion = String(body.descripcion ?? body.nombre).trim()
    }
    if (body?.porcentaje !== undefined) payload.porcentaje = Number(body.porcentaje)
    if (body?.porcentaje_recargo !== undefined) payload.porcentaje_recargo = Number(body.porcentaje_recargo)
    if (body?.subcuenta_compras_id !== undefined) payload.subcuenta_compras_id = body.subcuenta_compras_id
    if (body?.subcuenta_ventas_id !== undefined) payload.subcuenta_ventas_id = body.subcuenta_ventas_id
    if (body?.por_defecto !== undefined) payload.por_defecto = Boolean(body.por_defecto)

    if (payload.porcentaje !== undefined && (Number.isNaN(payload.porcentaje) || payload.porcentaje < 0 || payload.porcentaje > 100)) {
      return NextResponse.json({ error: 'porcentaje inválido' }, { status: 400 })
    }
    if (payload.porcentaje_recargo !== undefined && (Number.isNaN(payload.porcentaje_recargo) || payload.porcentaje_recargo < 0 || payload.porcentaje_recargo > 100)) {
      return NextResponse.json({ error: 'porcentaje_recargo inválido' }, { status: 400 })
    }
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    const data = await updateImpuesto(id, payload)
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
    await deleteImpuesto(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
