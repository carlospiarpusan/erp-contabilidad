import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getPeriodosContables } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'contabilidad')) {
      return NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 })
    }

    const ejercicioId = req.nextUrl.searchParams.get('ejercicio_id') ?? undefined
    const data = await getPeriodosContables(ejercicioId)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
