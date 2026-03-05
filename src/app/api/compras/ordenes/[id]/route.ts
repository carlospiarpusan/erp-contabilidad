import { NextRequest, NextResponse } from 'next/server'
import { getOrdenCompraById, aprobarOrden, cancelarOrden } from '@/lib/db/cotizaciones'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const data = await getOrdenCompraById(id)
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
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
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
