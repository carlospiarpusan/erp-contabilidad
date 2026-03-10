import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { getCompraById, cancelarCompra, pagarCompra } from '@/lib/db/compras'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await getCompraById(id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()

    if (body.accion === 'cancelar') {
      await cancelarCompra(id)
      return NextResponse.json({ ok: true })
    }

    if (body.accion === 'pagar') {
      const { forma_pago_id, valor, fecha, observaciones } = body
      if (!forma_pago_id || !valor) return NextResponse.json({ error: 'forma_pago_id y valor requeridos' }, { status: 400 })

      const [empresa_id, ejercicio] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
      if (!ejercicio) return NextResponse.json({ error: 'Sin ejercicio activo' }, { status: 400 })

      const recibo_id = await pagarCompra({
        empresa_id,
        documento_id:  id,
        forma_pago_id,
        ejercicio_id:  ejercicio.id,
        valor:         Number(valor),
        fecha:         fecha ?? new Date().toISOString().split('T')[0],
        observaciones,
      })
      return NextResponse.json({ recibo_id })
    }

    return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
