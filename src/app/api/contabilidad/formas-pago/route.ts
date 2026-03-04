import { NextRequest, NextResponse } from 'next/server'
import { getFormasPagoAll, createFormaPago } from '@/lib/db/contabilidad'

export async function GET() {
  try {
    const data = await getFormasPagoAll()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.descripcion || !body.tipo)
      return NextResponse.json({ error: 'descripcion y tipo requeridos' }, { status: 400 })
    const data = await createFormaPago(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
