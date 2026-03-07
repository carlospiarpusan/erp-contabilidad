import { NextRequest, NextResponse } from 'next/server'
import { updateProveedor, deleteProveedor } from '@/lib/db/compras'

interface Ctx { params: Promise<{ id: string }> }

const CAMPOS_EDITABLES = [
  'razon_social', 'contacto', 'tipo_documento', 'numero_documento', 'dv',
  'email', 'telefono', 'whatsapp', 'ciudad', 'departamento', 'direccion',
  'observaciones', 'activo',
]

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    // Solo permite campos editables para evitar conflictos RLS/schema
    const filtered = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    )
    const data = await updateProveedor(id, filtered)
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    await deleteProveedor(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
