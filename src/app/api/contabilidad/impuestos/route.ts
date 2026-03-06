import { NextRequest, NextResponse } from 'next/server'
import { getImpuestosAll, createImpuesto } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'

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

export async function GET() {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const data = await getImpuestosAll()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr

    const body = await req.json()

    const codigo = String(body?.codigo ?? '').trim().toUpperCase()
    const descripcion = String(body?.descripcion ?? body?.nombre ?? '').trim()
    const porcentaje = Number(body?.porcentaje)
    const porcentaje_recargo = Number(body?.porcentaje_recargo ?? 0)

    if (!codigo || !descripcion || Number.isNaN(porcentaje)) {
      return NextResponse.json({ error: 'codigo, descripcion y porcentaje requeridos' }, { status: 400 })
    }
    if (porcentaje < 0 || porcentaje > 100 || porcentaje_recargo < 0 || porcentaje_recargo > 100) {
      return NextResponse.json({ error: 'porcentajes inválidos' }, { status: 400 })
    }

    const data = await createImpuesto({
      codigo,
      descripcion,
      porcentaje,
      porcentaje_recargo,
      subcuenta_compras_id: body?.subcuenta_compras_id ?? null,
      subcuenta_ventas_id: body?.subcuenta_ventas_id ?? null,
      por_defecto: Boolean(body?.por_defecto),
    })
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
