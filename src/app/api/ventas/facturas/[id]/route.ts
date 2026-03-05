import { NextRequest, NextResponse } from 'next/server'
import { getFacturaById, cancelarFactura } from '@/lib/db/ventas'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const factura = await getFacturaById(id)
    return NextResponse.json(factura)
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }     = await params
    const { accion } = await req.json()

    if (accion === 'cancelar') {
      const result = await cancelarFactura(id)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
