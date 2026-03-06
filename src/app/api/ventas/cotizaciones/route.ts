import { NextRequest, NextResponse } from 'next/server'
import { getCotizaciones, createCotizacion } from '@/lib/db/cotizaciones'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getCotizaciones({
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
    const body = await req.json()
    const { cliente_id, bodega_id, fecha, vencimiento, observaciones, lineas } = body

    if (!cliente_id || !bodega_id || !lineas?.length) {
      return NextResponse.json({ error: 'Campos requeridos: cliente, bodega y al menos una línea' }, { status: 400 })
    }

    const [empresa_id, ejercicio_id] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
    const hoy = new Date().toISOString().split('T')[0]
    const id = await createCotizacion({
      empresa_id, ejercicio_id,
      cliente_id, bodega_id,
      fecha:      fecha      ?? hoy,
      vencimiento: vencimiento ?? hoy,
      observaciones,
      lineas,
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
