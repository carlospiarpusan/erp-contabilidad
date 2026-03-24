import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createAdjuntoSignedUrl } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

interface Context {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const { signedUrl } = await createAdjuntoSignedUrl(id)
    return NextResponse.redirect(new URL(signedUrl, req.url))
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
