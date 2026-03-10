import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { updateCuentaPUC } from '@/lib/db/contabilidad'
import { registrarAuditoria } from '@/lib/auditoria'
import { toErrorMsg } from '@/lib/utils/errors'

const TIPOS_CUENTA = new Set(['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'])
const NATURALEZAS = new Set(['debito', 'credito'])


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

    const payload: Record<string, unknown> = {}
    if (body?.codigo !== undefined) payload.codigo = String(body.codigo ?? '').trim()
    if (body?.descripcion !== undefined) payload.descripcion = String(body.descripcion ?? '').trim()
    if (body?.tipo !== undefined) {
      const tipo = String(body.tipo).trim()
      if (!TIPOS_CUENTA.has(tipo)) {
        return NextResponse.json({ error: 'tipo de cuenta inválido' }, { status: 400 })
      }
      payload.tipo = tipo
    }
    if (body?.nivel !== undefined) {
      const nivel = Number(body.nivel)
      if (!Number.isFinite(nivel) || nivel < 1 || nivel > 5) {
        return NextResponse.json({ error: 'nivel inválido (1-5)' }, { status: 400 })
      }
      payload.nivel = nivel
    }
    if (body?.naturaleza !== undefined) {
      const naturaleza = String(body.naturaleza).trim()
      if (!NATURALEZAS.has(naturaleza)) {
        return NextResponse.json({ error: 'naturaleza inválida' }, { status: 400 })
      }
      payload.naturaleza = naturaleza
    }
    if (body?.cuenta_padre_id !== undefined) {
      payload.cuenta_padre_id = body.cuenta_padre_id ? String(body.cuenta_padre_id) : null
    }
    if (body?.activa !== undefined) {
      payload.activa = Boolean(body.activa)
    }

    const data = await updateCuentaPUC(id, payload as Parameters<typeof updateCuentaPUC>[1])
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'cuentas_puc',
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const data = await updateCuentaPUC(id, { activa: false })
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'cuentas_puc',
      registro_id: id,
      accion: 'DELETE',
      datos_nuevos: { activa: false },
    })
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
