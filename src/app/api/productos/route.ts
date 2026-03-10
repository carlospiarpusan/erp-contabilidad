import { NextRequest, NextResponse } from 'next/server'
import { getProductos, createProducto } from '@/lib/db/productos'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'
import { revalidateTag } from 'next/cache'
import { getInventarioStatsTag, getStockBajoTag } from '@/lib/cache/empresa-tags'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'productos')) {
      return NextResponse.json({ error: 'Sin permisos para productos' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const result = await getProductos({
      busqueda:     searchParams.get('q') ?? searchParams.get('busqueda') ?? undefined,
      familia_id:   searchParams.get('familia_id') ?? undefined,
      fabricante_id: searchParams.get('fabricante_id') ?? undefined,
      activo:       searchParams.get('activo') === 'false' ? false : true,
      limit:        parseInt(searchParams.get('limit') ?? '50'),
      offset:       parseInt(searchParams.get('offset') ?? '0'),
      select_mode:  searchParams.get('select_mode') === 'selector' ? 'selector' : 'full',
      include_total: searchParams.get('include_total') === 'false' ? false : undefined,
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
    if (!puedeAcceder(session.rol, 'productos', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para gestionar productos' }, { status: 403 })
    }

    const body = await req.json()
    const { variantes, ...rest } = body
    const datos = {
      ...rest,
      familia_id:    rest.familia_id    || null,
      fabricante_id: rest.fabricante_id || null,
      impuesto_id:   rest.impuesto_id   || null,
      precio_venta2: rest.precio_venta2 > 0 ? rest.precio_venta2 : null,
    }
    const producto = await createProducto(datos)
    revalidateTag(getInventarioStatsTag(session.empresa_id), 'max')
    revalidateTag(getStockBajoTag(session.empresa_id), 'max')
    return NextResponse.json(producto, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
