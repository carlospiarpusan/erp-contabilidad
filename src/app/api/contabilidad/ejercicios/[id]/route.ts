import { NextRequest, NextResponse } from 'next/server'
import { updateEjercicio } from '@/lib/db/contabilidad'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = await updateEjercicio(id, body)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
