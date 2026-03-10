import { NextResponse } from 'next/server'
import { getInformeCartera } from '@/lib/db/informes'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { filas, total, resumen } = await getInformeCartera()
    return NextResponse.json({ filas, resumen: resumen.rangos, total })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
