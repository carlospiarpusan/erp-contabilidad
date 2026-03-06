import { NextResponse } from 'next/server'
import { getConsecutivos } from '@/lib/db/contabilidad'
import { getSession, puedeAcceder } from '@/lib/auth/session'

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : 'Error'
}

async function requireContabilidadAccess() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!puedeAcceder(session.rol, 'contabilidad')) {
    return NextResponse.json({ error: 'Sin permisos para contabilidad' }, { status: 403 })
  }
  return null
}

export async function GET() {
  try {
    const authErr = await requireContabilidadAccess()
    if (authErr) return authErr
    const data = await getConsecutivos()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 })
  }
}
