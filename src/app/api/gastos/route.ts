import { toErrorMsg } from '@/lib/utils/errors'
import { NextRequest, NextResponse } from 'next/server'
import { getGastos, createGasto } from '@/lib/db/gastos'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const result = await getGastos({
      busqueda: searchParams.get('busqueda') ?? undefined,
      desde:    searchParams.get('desde')    ?? undefined,
      hasta:    searchParams.get('hasta')    ?? undefined,
      limit:    searchParams.has('limit')  ? Number(searchParams.get('limit'))  : undefined,
      offset:   searchParams.has('offset') ? Number(searchParams.get('offset')) : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tipo_gasto_id, forma_pago_id, descripcion, valor } = body
    if (!tipo_gasto_id) return NextResponse.json({ error: 'tipo_gasto_id requerido' }, { status: 400 })
    if (!forma_pago_id) return NextResponse.json({ error: 'forma_pago_id requerido' }, { status: 400 })
    if (!descripcion)   return NextResponse.json({ error: 'descripcion requerida' },   { status: 400 })
    if (!valor || valor <= 0) return NextResponse.json({ error: 'valor debe ser > 0' }, { status: 400 })

    const [empresa_id, ejercicio] = await Promise.all([getEmpresaId(), getEjercicioActivo()])
    if (!ejercicio) return NextResponse.json({ error: 'Sin ejercicio activo' }, { status: 400 })

    const id = await createGasto({
      empresa_id, ejercicio_id: ejercicio.id,
      acreedor_id: body.acreedor_id || undefined,
      tipo_gasto_id, forma_pago_id,
      fecha:       body.fecha ?? new Date().toISOString().split('T')[0],
      descripcion, valor: Number(valor),
      observaciones: body.observaciones,
    })
    return NextResponse.json({ id }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
