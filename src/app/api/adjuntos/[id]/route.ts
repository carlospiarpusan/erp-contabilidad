import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { deleteAdjuntoPrivado } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

interface Context {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await deleteAdjuntoPrivado(id)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
