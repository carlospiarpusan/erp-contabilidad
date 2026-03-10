import { NextRequest, NextResponse } from 'next/server'
import { updateProveedor, deleteProveedor } from '@/lib/db/compras'
import { toErrorMsg } from '@/lib/utils/errors'
import { getSession } from '@/lib/auth/session'

interface Ctx { params: Promise<{ id: string }> }

const CAMPOS_EDITABLES = [
  'razon_social', 'contacto', 'tipo_documento', 'numero_documento', 'dv',
  'email', 'telefono', 'whatsapp', 'ciudad', 'departamento', 'direccion',
  'observaciones', 'activo',
]

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const filtered = Object.fromEntries(
      Object.entries(body).filter(([k]) => CAMPOS_EDITABLES.includes(k))
    )
    const data = await updateProveedor(id, filtered)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const data = await deleteProveedor(id)
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
