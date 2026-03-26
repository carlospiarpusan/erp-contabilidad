import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { getOrdenCompraById, aprobarOrden, cancelarOrden } from '@/lib/db/cotizaciones'
import { getSession } from '@/lib/auth/session'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await getOrdenCompraById(id)
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const { accion } = await req.json()

    if (accion === 'aprobar') {
      await aprobarOrden(id)
      return NextResponse.json({ ok: true })
    }

    if (accion === 'cancelar') {
      await cancelarOrden(id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
