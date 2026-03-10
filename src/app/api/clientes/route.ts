import { NextRequest, NextResponse } from 'next/server'
import { getClientes, createCliente } from '@/lib/db/clientes'
import { getSession } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const result = await getClientes({
      busqueda: searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined,
      grupo_id: searchParams.get('grupo_id') ?? undefined,
      activo:   searchParams.get('activo') === 'false' ? false : true,
      limit:    parseInt(searchParams.get('limit') ?? '50'),
      offset:   parseInt(searchParams.get('offset') ?? '0'),
      select_mode: searchParams.get('select_mode') === 'selector' ? 'selector' : 'full',
      include_total: searchParams.get('include_total') === 'false' ? false : undefined,
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const cliente = await createCliente(body)
    return NextResponse.json(cliente, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
