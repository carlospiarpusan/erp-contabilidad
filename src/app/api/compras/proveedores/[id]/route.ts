import { NextRequest, NextResponse } from 'next/server'
import { updateProveedor, deleteProveedor } from '@/lib/db/compras'

interface Ctx { params: Promise<{ id: string }> }

function toMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.details === 'string') return obj.details
  }
  return 'Error inesperado'
}

const CAMPOS_EDITABLES = [
  'razon_social', 'contacto', 'tipo_documento', 'numero_documento', 'dv',
  'email', 'telefono', 'whatsapp', 'ciudad', 'departamento', 'direccion',
  'observaciones', 'activo',
]

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    const body = await req.json()
    const filtered = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    )
    const data = await updateProveedor(id, filtered)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toMsg(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params
    await deleteProveedor(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: toMsg(e) }, { status: 500 })
  }
}
