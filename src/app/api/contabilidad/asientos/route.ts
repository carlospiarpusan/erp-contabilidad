import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { createAsientoManual, getAsientos } from '@/lib/db/contabilidad'
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

export async function GET(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde') ?? undefined
    const hasta = searchParams.get('hasta') ?? undefined
    const tipo_doc = searchParams.get('tipo_doc') ?? undefined
    const limit = Number(searchParams.get('limit') ?? 100)
    const offset = Number(searchParams.get('offset') ?? 0)

    const data = await getAsientos({
      desde,
      hasta,
      tipo_doc,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await req.json()

    const fecha = String(body?.fecha ?? '')
    const concepto = String(body?.concepto ?? '').trim()
    const lineasRaw = Array.isArray(body?.lineas) ? body.lineas : []
    const lineas: LineaPayload[] = lineasRaw.map((l: Record<string, unknown>) => ({
      cuenta_id: String(l.cuenta_id ?? ''),
      descripcion: l.descripcion ? String(l.descripcion) : '',
      debe: Number(l.debe ?? 0),
      haber: Number(l.haber ?? 0),
    }))

    if (!fecha || !concepto || lineas.length < 2) {
      return NextResponse.json(
        { error: 'fecha, concepto y al menos 2 líneas son requeridos' },
        { status: 400 }
      )
    }

    const data = await createAsientoManual({ fecha, concepto, lineas })
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'asientos',
      registro_id: data.id,
      accion: 'INSERT',
      datos_nuevos: { fecha, concepto, lineas },
      ip: req.headers.get('x-forwarded-for'),
    })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
