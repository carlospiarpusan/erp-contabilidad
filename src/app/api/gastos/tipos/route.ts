import { NextRequest, NextResponse } from 'next/server'
import { getTiposGasto, createTipoGasto } from '@/lib/db/gastos'

export async function GET() {
  try {
    const data = await getTiposGasto()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.descripcion) return NextResponse.json({ error: 'descripcion requerida' }, { status: 400 })
    const data = await createTipoGasto(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
