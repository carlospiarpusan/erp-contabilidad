import { NextRequest, NextResponse } from 'next/server'
import { ajustarStock } from '@/lib/db/productos'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { producto_id, bodega_id, tipo, cantidad, notas } = body

    if (!producto_id || !bodega_id || !tipo || !cantidad) {
      return NextResponse.json({ error: 'Campos requeridos: producto_id, bodega_id, tipo, cantidad' }, { status: 400 })
    }

    await ajustarStock({ producto_id, bodega_id, tipo, cantidad: Number(cantidad), notas })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
