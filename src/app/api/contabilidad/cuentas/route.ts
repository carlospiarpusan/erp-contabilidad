import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { createCuentaPUC, getCuentasPUC } from '@/lib/db/contabilidad'
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

export async function GET(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const { searchParams } = new URL(req.url)
    const busqueda = searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined
    const nivel = searchParams.get('nivel')
    const nivelNum = nivel ? Number(nivel) : undefined
    const data = await getCuentasPUC({
      busqueda,
      nivel: Number.isFinite(nivelNum) ? nivelNum : undefined,
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
    const codigo = String(body?.codigo ?? '').trim()
    const descripcion = String(body?.descripcion ?? '').trim()
    const tipo = String(body?.tipo ?? '').trim()
    const nivel = Number(body?.nivel)
    const naturaleza = String(body?.naturaleza ?? 'debito').trim()
    const cuenta_padre_id = body?.cuenta_padre_id ? String(body.cuenta_padre_id) : null

    if (!codigo || !descripcion || !tipo || !Number.isFinite(nivel)) {
      return NextResponse.json({ error: 'codigo, descripcion, tipo y nivel son requeridos' }, { status: 400 })
    }
    if (!TIPOS_CUENTA.has(tipo)) {
      return NextResponse.json({ error: 'tipo de cuenta inválido' }, { status: 400 })
    }
    if (nivel < 1 || nivel > 5) {
      return NextResponse.json({ error: 'nivel inválido (1-5)' }, { status: 400 })
    }
    if (!NATURALEZAS.has(naturaleza)) {
      return NextResponse.json({ error: 'naturaleza inválida' }, { status: 400 })
    }

    const data = await createCuentaPUC({
      codigo,
      descripcion,
      tipo,
      nivel,
      naturaleza: naturaleza as 'debito' | 'credito',
      cuenta_padre_id,
      activa: body?.activa !== false,
    })
    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'cuentas_puc',
      registro_id: data.id,
      accion: 'INSERT',
      datos_nuevos: data,
      ip: req.headers.get('x-forwarded-for'),
    })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
