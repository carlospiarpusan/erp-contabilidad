import { NextRequest, NextResponse } from 'next/server'
import { updateConsecutivo } from '@/lib/db/contabilidad'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const data = await updateConsecutivo(id, await req.json())
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
