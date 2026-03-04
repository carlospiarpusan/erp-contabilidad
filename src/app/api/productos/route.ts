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
    const producto = await createProducto(body)
    return NextResponse.json(producto, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
