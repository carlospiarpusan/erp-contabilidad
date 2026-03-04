import { NextRequest, NextResponse } from 'next/server'
import { getFacturas, createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const result = await getFacturas({
      busqueda: searchParams.get('q') ?? undefined,
      estado:   searchParams.get('estado') ?? undefined,
      desde:    searchParams.get('desde') ?? undefined,
      hasta:    searchParams.get('hasta') ?? undefined,
      limit:    parseInt(searchParams.get('limit') ?? '50'),
      offset:   parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cliente_id, bodega_id, forma_pago_id, lineas } = body

    if (!cliente_id || !bodega_id || !forma_pago_id || !lineas?.length) {
      return NextResponse.json({ error: 'Campos requeridos: cliente, bodega, forma de pago, y al menos una línea' }, { status: 400 })
    }

    const [empresa_id, ejercicio] = await Promise.all([
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    const doc_id = await createFactura({
      empresa_id,
      ejercicio_id:     ejercicio.id,
      cliente_id,
      bodega_id,
      forma_pago_id,
      colaborador_id:   body.colaborador_id || null,
      fecha:            body.fecha || new Date().toISOString().slice(0, 10),
      fecha_vencimiento: body.fecha_vencimiento || null,
      observaciones:    body.observaciones || null,
      lineas,
    })

    return NextResponse.json({ id: doc_id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al crear factura' }, { status: 500 })
  }
}
