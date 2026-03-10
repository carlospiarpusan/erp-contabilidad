import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { revertirAsiento } from '@/lib/db/contabilidad'
import { registrarAuditoria } from '@/lib/auditoria'
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const concepto = body?.concepto ? String(body.concepto) : undefined
    const data = await revertirAsiento(id, { tipo_doc: 'reversion_manual', concepto })
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'asientos',
      registro_id: data.id,
      accion: 'INSERT',
      datos_nuevos: { tipo_doc: 'reversion_manual', origen_asiento_id: id },
      ip: req.headers.get('x-forwarded-for'),
    })
    return NextResponse.json({ ok: true, data })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
