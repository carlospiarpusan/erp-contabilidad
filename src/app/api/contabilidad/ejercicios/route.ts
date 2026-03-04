import { NextRequest, NextResponse } from 'next/server'
import { getEjerciciosAll, createEjercicio } from '@/lib/db/contabilidad'

export async function GET() {
  try {
    const data = await getEjerciciosAll()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.año || !body.fecha_inicio || !body.fecha_fin)
      return NextResponse.json({ error: 'año, fecha_inicio y fecha_fin requeridos' }, { status: 400 })
    const data = await createEjercicio(body)
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
