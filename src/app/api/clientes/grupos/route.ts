import { NextRequest, NextResponse } from 'next/server'
import { getGruposClientes, createGrupo } from '@/lib/db/clientes'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const grupos = await getGruposClientes()
    return NextResponse.json({ grupos })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const datos = await req.json()
    if (!datos.nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    const grupo = await createGrupo(datos)
    return NextResponse.json(grupo, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
