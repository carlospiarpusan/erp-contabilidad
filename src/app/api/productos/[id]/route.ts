import { NextRequest, NextResponse } from 'next/server'
import { getProductoById, updateProducto } from '@/lib/db/productos'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const producto = await getProductoById(id)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const datos   = await req.json()
    const producto = await updateProducto(id, datos)
    return NextResponse.json(producto)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
