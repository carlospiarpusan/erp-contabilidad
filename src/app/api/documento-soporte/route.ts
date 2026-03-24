import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getDocumentoSoporte, upsertDocumentoSoporte } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'compras')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const documentoId = req.nextUrl.searchParams.get('documento_id')
    if (!documentoId) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

    const data = await getDocumentoSoporte(documentoId)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!puedeAcceder(session.rol, 'compras', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await req.json()
    const documentoId = String(body?.documento_id ?? '')
    if (!documentoId) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

    const data = await upsertDocumentoSoporte(documentoId, {
      requerido: body?.requerido !== false,
      estado: body?.estado,
      proveedor_tecnologico: typeof body?.proveedor_tecnologico === 'string' ? body.proveedor_tecnologico : null,
      numero_externo: typeof body?.numero_externo === 'string' ? body.numero_externo : null,
      fecha_emision: typeof body?.fecha_emision === 'string' ? body.fecha_emision : null,
      archivo_adjunto_id: typeof body?.archivo_adjunto_id === 'string' ? body.archivo_adjunto_id : null,
      observaciones: typeof body?.observaciones === 'string' ? body.observaciones : null,
      validado_por: session.id,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
