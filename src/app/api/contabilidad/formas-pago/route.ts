import { NextRequest, NextResponse } from 'next/server'
import { getFormasPagoAll, createFormaPago } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

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

export async function GET() {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const data = await getFormasPagoAll()
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
    const descripcion = String(body?.descripcion ?? '').trim()
    const tipo = String(body?.tipo ?? '').trim()
    const dias_vencimiento = Number(body?.dias_vencimiento ?? 0)
    const cuenta_id = body?.cuenta_id ? String(body.cuenta_id) : undefined

    if (!descripcion || !tipo) {
      return NextResponse.json({ error: 'descripcion y tipo requeridos' }, { status: 400 })
    }
    if (!TIPOS_FORMA_PAGO.has(tipo)) {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }
    if (Number.isNaN(dias_vencimiento) || dias_vencimiento < 0) {
      return NextResponse.json({ error: 'dias_vencimiento inválido' }, { status: 400 })
    }

    const data = await createFormaPago({ descripcion, tipo, dias_vencimiento, cuenta_id })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
