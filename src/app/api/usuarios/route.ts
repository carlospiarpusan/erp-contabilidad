import { NextRequest, NextResponse } from 'next/server'
import { getUsuarios, invitarUsuario, getRoles } from '@/lib/db/usuarios'

export async function GET() {
  try {
    const [usuarios, roles] = await Promise.all([getUsuarios(), getRoles()])
    return NextResponse.json({ usuarios, roles })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, nombre, rol_id } = await req.json()
    if (!email || !nombre || !rol_id) {
      return NextResponse.json({ error: 'Campos requeridos: email, nombre, rol_id' }, { status: 400 })
    }
    await invitarUsuario(email, nombre, rol_id)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
