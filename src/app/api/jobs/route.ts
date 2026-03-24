import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { enqueueJob, listJobs } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'configuracion')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 50)
    const data = await listJobs(Number.isFinite(limit) ? limit : 50)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const tipo = String(body?.tipo ?? '').trim()
    if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })

    const data = await enqueueJob({
      session,
      tipo,
      payload: body?.payload && typeof body.payload === 'object' ? body.payload : undefined,
      runAt: typeof body?.run_at === 'string' ? body.run_at : undefined,
      maxAttempts: Number.isFinite(Number(body?.max_attempts)) ? Number(body.max_attempts) : undefined,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
