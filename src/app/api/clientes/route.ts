import { NextRequest, NextResponse } from 'next/server'
import { getClientes, createCliente } from '@/lib/db/clientes'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getClientes({
      busqueda: searchParams.get('q') ?? undefined,
      grupo_id: searchParams.get('grupo_id') ?? undefined,
      activo:   searchParams.get('activo') === 'false' ? false : true,
      limit:    parseInt(searchParams.get('limit') ?? '50'),
      offset:   parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cliente = await createCliente(body)
    return NextResponse.json(cliente, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
