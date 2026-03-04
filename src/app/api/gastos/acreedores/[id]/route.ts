import { NextRequest, NextResponse } from 'next/server'
import { updateAcreedor } from '@/lib/db/gastos'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const data = await updateAcreedor(id, body)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
