import { NextRequest, NextResponse } from 'next/server'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { getRegulatoryConfig, getUvtVigencias, updateRegulatoryConfig, upsertUvtVigencia } from '@/lib/db/compliance'
import { toErrorMsg } from '@/lib/utils/errors'

async function requireConfigSession() {
  const session = await getSession()
  if (!session) {
    return { session: null, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (!puedeAcceder(session.rol, 'configuracion', 'manage')) {
    return { session: null, response: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }
  return { session, response: null }
}

export async function GET() {
  try {
    const auth = await requireConfigSession()
    if (auth.response) return auth.response

    const [config, uvts] = await Promise.all([
      getRegulatoryConfig(),
      getUvtVigencias(),
    ])
    return NextResponse.json({ config, uvts })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireConfigSession()
    if (auth.response) return auth.response

    const body = await req.json()
    const data = await updateRegulatoryConfig({
      obligado_fe: Boolean(body?.obligado_fe),
      usa_proveedor_fe: Boolean(body?.usa_proveedor_fe),
      requiere_documento_soporte: body?.requiere_documento_soporte !== false,
      reporta_exogena: body?.reporta_exogena !== false,
      usa_radian: Boolean(body?.usa_radian),
      politica_datos_version: typeof body?.politica_datos_version === 'string' ? body.politica_datos_version : null,
      politica_datos_url: typeof body?.politica_datos_url === 'string' ? body.politica_datos_url : null,
      aviso_privacidad_url: typeof body?.aviso_privacidad_url === 'string' ? body.aviso_privacidad_url : null,
      contacto_privacidad_email: typeof body?.contacto_privacidad_email === 'string' ? body.contacto_privacidad_email : null,
    })
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireConfigSession()
    if (auth.response) return auth.response

    const body = await req.json()
    if (body?.kind !== 'uvt') {
      return NextResponse.json({ error: 'Operación no soportada' }, { status: 400 })
    }

    const año = Number(body?.año)
    const valor = Number(body?.valor)
    if (!Number.isInteger(año) || año < 2000 || !Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: 'Año y valor UVT inválidos' }, { status: 400 })
    }

    const data = await upsertUvtVigencia({
      año,
      valor,
      fuente: typeof body?.fuente === 'string' ? body.fuente : null,
    })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toErrorMsg(error) }, { status: 500 })
  }
}
