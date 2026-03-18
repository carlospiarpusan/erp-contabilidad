import { NextRequest, NextResponse } from 'next/server'
import { getRemisiones, createRemision } from '@/lib/db/remisiones'
import { getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const result = await getRemisiones({
      estado: searchParams.get('estado') ?? undefined,
      desde:  searchParams.get('desde')  ?? undefined,
      hasta:  searchParams.get('hasta')  ?? undefined,
      limit:  parseInt(searchParams.get('limit')  ?? '50'),
      offset: parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { cliente_id, bodega_id, fecha, vencimiento, observaciones, lineas } = body

    if (!cliente_id || !bodega_id || !lineas?.length) {
      return NextResponse.json({ error: 'Campos requeridos: cliente, bodega y al menos una línea' }, { status: 400 })
    }

    const ejercicio = await getEjercicioActivo()
    if (!ejercicio?.id) {
      return NextResponse.json({ error: 'No hay ejercicio activo' }, { status: 400 })
    }
    const hoy = new Date().toISOString().split('T')[0]
    const id = await createRemision({
      ejercicio_id: ejercicio.id, cliente_id, bodega_id,
      fecha: fecha ?? hoy, vencimiento: vencimiento ?? hoy, observaciones, lineas,
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
