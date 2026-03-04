import { NextRequest, NextResponse } from 'next/server'
import { getImpuestosAll, createImpuesto } from '@/lib/db/contabilidad'

export async function GET() {
  try {
    const data = await getImpuestosAll()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.nombre || body.porcentaje === undefined)
      return NextResponse.json({ error: 'nombre y porcentaje requeridos' }, { status: 400 })
    const data = await createImpuesto(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
