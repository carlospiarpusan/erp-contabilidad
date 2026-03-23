import { NextRequest, NextResponse } from 'next/server'
import { deleteProducto, getProductoById, updateProducto } from '@/lib/db/productos'
import { getSession } from '@/lib/auth/session'
import { puedeAcceder } from '@/lib/auth/session'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'

function normalizeOptionalPrice(value: unknown) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'productos')) {
      return NextResponse.json({ error: 'Sin permisos para productos' }, { status: 403 })
    }

    const { id } = await params
    const producto = await getProductoById(id)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'productos', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para gestionar productos' }, { status: 403 })
    }

    const { id } = await params
    const body   = await req.json()
    // Strip join relations and variantes — only persist scalar columns
    const {
      variantes,
      familia,
      fabricante,
      impuesto,
      stock,
      producto_variantes,
      inventario_inicial,
      bodega_inicial_id,
      ...rest
    } = body
    const datos = {
      ...rest,
      familia_id:    rest.familia_id    || null,
      fabricante_id: rest.fabricante_id || null,
      impuesto_id:   rest.impuesto_id   || null,
      precio_venta2: normalizeOptionalPrice(rest.precio_venta2),
    }
    const producto = await updateProducto(id, datos)
    revalidateInventoryDependentViews(session.empresa_id)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'productos', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para gestionar productos' }, { status: 403 })
    }

    const { id } = await params
    const result = await deleteProducto(id)
    revalidateInventoryDependentViews(session.empresa_id)
    return NextResponse.json(result)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
