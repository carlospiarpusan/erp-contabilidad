import { NextRequest, NextResponse } from 'next/server'
import { getProductos, createProducto } from '@/lib/db/productos'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getProductos({
      busqueda:     searchParams.get('q') ?? undefined,
      familia_id:   searchParams.get('familia_id') ?? undefined,
      fabricante_id: searchParams.get('fabricante_id') ?? undefined,
      activo:       searchParams.get('activo') === 'false' ? false : true,
      limit:        parseInt(searchParams.get('limit') ?? '50'),
      offset:       parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variantes, ...rest } = body
    const datos = {
      ...rest,
      familia_id:    rest.familia_id    || null,
      fabricante_id: rest.fabricante_id || null,
      impuesto_id:   rest.impuesto_id   || null,
      precio_venta2: rest.precio_venta2 > 0 ? rest.precio_venta2 : null,
    }
    const producto = await createProducto(datos)
    return NextResponse.json(producto, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
