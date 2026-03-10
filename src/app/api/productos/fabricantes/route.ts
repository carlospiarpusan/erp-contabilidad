import { NextRequest, NextResponse } from 'next/server'
import { getFabricantes, createFabricante } from '@/lib/db/productos'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const fabricantes = await getFabricantes()
    return NextResponse.json({ fabricantes })
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
    const fabricante = await createFabricante(datos)
    return NextResponse.json(fabricante, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
