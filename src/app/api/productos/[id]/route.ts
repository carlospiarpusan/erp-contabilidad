import { NextRequest, NextResponse } from 'next/server'
import { getProductoById, updateProducto } from '@/lib/db/productos'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const producto = await getProductoById(id)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body   = await req.json()
    // Strip join relations and variantes — only persist scalar columns
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variantes, familia, fabricante, impuesto, stock, producto_variantes, ...rest } = body
    const datos = {
      ...rest,
      familia_id:    rest.familia_id    || null,
      fabricante_id: rest.fabricante_id || null,
      impuesto_id:   rest.impuesto_id   || null,
      precio_venta2: rest.precio_venta2 > 0 ? rest.precio_venta2 : null,
    }
    const producto = await updateProducto(id, datos)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
