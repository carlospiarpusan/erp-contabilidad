import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { updateAcreedor } from '@/lib/db/gastos'
import { getSession } from '@/lib/auth/session'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const data = await updateAcreedor(id, body)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
