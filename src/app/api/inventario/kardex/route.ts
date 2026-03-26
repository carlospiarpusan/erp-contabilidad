import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

const ROLES_KARDEX = new Set(['admin', 'contador'])

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !ROLES_KARDEX.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const producto_id = searchParams.get('producto_id')

    if (!producto_id) {
      return NextResponse.json({ error: 'producto_id es requerido' }, { status: 400 })
    }

    const bodega_id = searchParams.get('bodega_id') || null
    const desde = searchParams.get('desde') || null
    const hasta = searchParams.get('hasta') || null

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('kardex_producto', {
      p_producto_id: producto_id,
      p_bodega_id: bodega_id,
      p_desde: desde,
      p_hasta: hasta,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ movimientos: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
