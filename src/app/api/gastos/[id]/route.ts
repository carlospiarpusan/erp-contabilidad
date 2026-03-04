import { NextRequest, NextResponse } from 'next/server'
import { getGastoById, cancelarGasto } from '@/lib/db/gastos'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const data = await getGastoById(id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const { accion } = await req.json()
    if (accion === 'cancelar') {
      await cancelarGasto(id)
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'accion desconocida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
