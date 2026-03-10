import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { getAcreedores, createAcreedor } from '@/lib/db/gastos'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const result = await getAcreedores({
      busqueda: searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined,
      activo: searchParams.has('activo') ? searchParams.get('activo') === 'true' : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    if (!body.razon_social) return NextResponse.json({ error: 'razon_social requerida' }, { status: 400 })
    const data = await createAcreedor(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
