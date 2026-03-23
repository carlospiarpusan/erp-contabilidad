import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { getCompras, createCompra } from '@/lib/db/compras'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'

function getErrorStatus(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '')
    if (code === 'P0001' || code.startsWith('23')) return 400
  }
  return 500
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const result = await getCompras({
      busqueda: searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined,
      estado: searchParams.get('estado') ?? undefined,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
      offset: searchParams.has('offset') ? Number(searchParams.get('offset')) : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { proveedor_id, bodega_id, fecha, numero_externo, lineas } = body

    if (!proveedor_id) return NextResponse.json({ error: 'proveedor_id requerido' }, { status: 400 })
    if (!bodega_id) return NextResponse.json({ error: 'bodega_id requerido' }, { status: 400 })
    if (!numero_externo) return NextResponse.json({ error: 'numero_externo requerido' }, { status: 400 })
    if (!lineas || !lineas.length) return NextResponse.json({ error: 'lineas requeridas' }, { status: 400 })

    const [empresa_id, ejercicio] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
    if (!ejercicio) return NextResponse.json({ error: 'Sin ejercicio activo' }, { status: 400 })

    const id = await createCompra({
      empresa_id,
      ejercicio_id: ejercicio.id,
      proveedor_id,
      bodega_id,
      fecha: fecha ?? new Date().toISOString().split('T')[0],
      numero_externo,
      observaciones: body.observaciones,
      lineas,
    })

    revalidateInventoryDependentViews(empresa_id)

    return NextResponse.json({ id }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}
