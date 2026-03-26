import { NextRequest, NextResponse } from 'next/server'
import { getFacturaById, cancelarFactura } from '@/lib/db/ventas'
import { ACCOUNTING_ROLES } from '@/lib/auth/permissions'
import { getSession } from '@/lib/auth/session'
import { getErrorStatus, toErrorMsg } from '@/lib/utils/errors'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const factura = await getFacturaById(id)
    return NextResponse.json(factura)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id }     = await params
    const { accion } = await req.json()

    if (accion === 'cancelar') {
      if (!(ACCOUNTING_ROLES as readonly string[]).includes(session.rol)) {
        return NextResponse.json({ error: 'Solo admin o contador pueden anular facturas contabilizadas' }, { status: 403 })
      }
      const result = await cancelarFactura(id)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}
