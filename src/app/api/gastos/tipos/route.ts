import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { getTiposGasto, createTipoGasto } from '@/lib/db/gastos'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await getTiposGasto()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    if (!body.descripcion) return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 })
    const data = await createTipoGasto(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
