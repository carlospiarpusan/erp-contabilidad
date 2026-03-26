import { NextRequest, NextResponse } from 'next/server'
import { getClienteById, updateCliente, deleteCliente } from '@/lib/db/clientes'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params
    const cliente = await getClienteById(id)
    return NextResponse.json(cliente)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 404 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'clientes', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para gestionar clientes' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const cliente = await updateCliente(id, body)
    return NextResponse.json(cliente)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'clientes', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para gestionar clientes' }, { status: 403 })
    }

    const { id } = await params
    await deleteCliente(id)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
