import { NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { processPendingJobs } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

function hasCronAccess(request: Request) {
  const secret = process.env.JOBS_CRON_SECRET || process.env.CRON_SECRET
  if (!secret) return false

  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  try {
    let lockedBy = 'manual'

    if (hasCronAccess(request)) {
      lockedBy = 'cron'
    } else {
      const session = await getSession()
      if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
      }
      lockedBy = `manual:${session.id}`
    }

    const results = await processPendingJobs({ lockedBy })
    return NextResponse.json({ ok: true, results })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
