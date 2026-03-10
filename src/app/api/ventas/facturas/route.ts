import { NextRequest, NextResponse } from 'next/server'
import { getFacturas, createFactura } from '@/lib/db/ventas'
import { getEjercicioActivo, getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'
import { revalidateTag } from 'next/cache'
import { getInventarioStatsTag, getReportTag, getStockBajoTag, getVentasStatsTag } from '@/lib/cache/empresa-tags'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const result = await getFacturas({
      busqueda: searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined,
      estado:   searchParams.get('estado') ?? undefined,
      desde:    searchParams.get('desde') ?? undefined,
      hasta:    searchParams.get('hasta') ?? undefined,
      cliente_id: searchParams.get('cliente_id') ?? undefined,
      limit:    parseInt(searchParams.get('limit') ?? '50'),
      offset:   parseInt(searchParams.get('offset') ?? '0'),
    })
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

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

    revalidateTag(getVentasStatsTag(empresa_id), 'max')
    revalidateTag(getInventarioStatsTag(empresa_id), 'max')
    revalidateTag(getStockBajoTag(empresa_id), 'max')
    revalidateTag(getReportTag(empresa_id), 'max')

    return NextResponse.json({ id: doc_id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
