import { NextRequest, NextResponse } from 'next/server'
import { getProveedores, createProveedor } from '@/lib/db/compras'

function toMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
  }
  return 'Error inesperado'
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const result = await getProveedores({
      busqueda: searchParams.get('busqueda') ?? undefined,
      activo:   searchParams.has('activo') ? searchParams.get('activo') === 'true' : undefined,
      limit:    searchParams.has('limit')  ? Number(searchParams.get('limit'))  : undefined,
      offset:   searchParams.has('offset') ? Number(searchParams.get('offset')) : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: toMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.razon_social) return NextResponse.json({ error: 'razon_social requerida' }, { status: 400 })
    const data = await createProveedor(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toMsg(e) }, { status: 500 })
  }
}
