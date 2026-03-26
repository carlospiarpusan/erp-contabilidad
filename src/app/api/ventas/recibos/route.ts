import { NextRequest, NextResponse } from 'next/server'
import { getErrorStatus, toErrorMsg } from '@/lib/utils/errors'
import { getRecibos, createRecibo } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const result = await getRecibos({
      documento_id: searchParams.get('documento_id') ?? undefined,
      limit:        parseInt(searchParams.get('limit') ?? '50'),
      offset:       parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { documento_id, forma_pago_id, valor, fecha, observaciones } = body

    if (!documento_id || !forma_pago_id || !valor) {
      return NextResponse.json({ error: 'Campos requeridos: documento, forma de pago y valor' }, { status: 400 })
    }

    const [empresa_id, ejercicio] = await Promise.all([
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    if (!ejercicio?.id) {
      return NextResponse.json({ error: 'Sin ejercicio activo' }, { status: 400 })
    }

    const recibo_id = await createRecibo({
      empresa_id,
      ejercicio_id:  ejercicio.id,
      documento_id,
      forma_pago_id,
      valor:         Number(valor),
      fecha:         fecha || new Date().toISOString().slice(0, 10),
      observaciones: observaciones || null,
    })

    return NextResponse.json({ id: recibo_id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}
