import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { aplicarPagoMensualSistecredito } from '@/lib/db/ventas'
import { toErrorMsg } from '@/lib/utils/errors'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (!puedeAcceder(session.rol, 'contabilidad')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const { mes_venta, forma_pago_id, fecha_pago, observaciones } = body ?? {}

    if (!mes_venta || !forma_pago_id) {
      return NextResponse.json({
        error: 'Campos requeridos: mes de venta y forma de recaudo',
      }, { status: 400 })
    }

    const result = await aplicarPagoMensualSistecredito({
      mes_venta: String(mes_venta),
      forma_pago_id: String(forma_pago_id),
      fecha_pago: fecha_pago ? String(fecha_pago) : undefined,
      observaciones: observaciones ? String(observaciones) : null,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({
      error: toErrorMsg(error),
    }, { status: 500 })
  }
}
