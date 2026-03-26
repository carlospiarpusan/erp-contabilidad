import { NextRequest, NextResponse } from 'next/server'
import { getErrorStatus, toErrorMsg } from '@/lib/utils/errors'
import { getSession } from '@/lib/auth/session'
import { ensurePeriodoAbierto } from '@/lib/db/compliance'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'
import { getRecibosCompraContables, pagarCompra } from '@/lib/db/compras'

const ROLES = ['admin', 'contador']

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const recibos = await getRecibosCompraContables({ limit: 100 })
    return NextResponse.json(recibos)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!ROLES.includes(session.rol))
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

    const body = await req.json()
    const { documento_id, forma_pago_id, monto_total, observaciones } = body
    const fecha = typeof body?.fecha === 'string' && body.fecha ? body.fecha : new Date().toISOString().split('T')[0]
    if (!documento_id || !forma_pago_id || !monto_total) {
      return NextResponse.json({ error: 'documento_id, forma_pago_id y monto_total son requeridos' }, { status: 400 })
    }

    await ensurePeriodoAbierto({
      session,
      fecha,
      source: 'api:pagos-proveedores',
      method: req.method,
      route: '/api/tesoreria/pagos-proveedores',
      context: { documento_id, forma_pago_id },
    })

    const [empresa_id, ejercicio] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
    if (!ejercicio?.id) {
      return NextResponse.json({ error: 'Sin ejercicio activo' }, { status: 400 })
    }

    const recibo_id = await pagarCompra({
      empresa_id,
      documento_id,
      forma_pago_id,
      ejercicio_id: ejercicio.id,
      valor: Number(monto_total),
      fecha,
      observaciones: observaciones || null,
      retenciones: Array.isArray(body.retenciones) ? body.retenciones : [],
    })

    return NextResponse.json({ recibo_id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}
