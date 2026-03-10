import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { registrarAuditoria } from '@/lib/auditoria'
import { toErrorMsg } from '@/lib/utils/errors'

const ESTADOS_DIAN = new Set(['enviada', 'aceptada', 'rechazada'])


function generarCufe(id: string) {
  const seed = `${Date.now()}-${id.slice(0, 8)}-${Math.random().toString(36).slice(2, 10)}`
  return `CUFE-${seed.toUpperCase()}`
}

function appBaseUrl(req: NextRequest) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')
  return new URL(req.url).origin
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await params
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('documentos')
      .select('id, dian_estado, cufe, qr_url, updated_at')
      .eq('id', id)
      .eq('tipo', 'factura_venta')
      .single()
    if (error || !data) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos para envío DIAN' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()
    const { data: factura, error: facturaErr } = await supabase
      .from('documentos')
      .select('id, numero, prefijo, estado, dian_estado, cufe, qr_url')
      .eq('id', id)
      .eq('tipo', 'factura_venta')
      .single()

    if (facturaErr || !factura) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    if (factura.estado === 'cancelada') {
      return NextResponse.json({ error: 'No se puede enviar una factura cancelada' }, { status: 400 })
    }

    const cufe = factura.cufe || generarCufe(id)
    const qr_url = factura.qr_url || `${appBaseUrl(req)}/print/factura/${id}`
    const dian_estado = 'enviada'

    const { error: updErr } = await supabase
      .from('documentos')
      .update({ dian_estado, cufe, qr_url, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tipo', 'factura_venta')
    if (updErr) throw updErr

    const webhook = process.env.DIAN_WEBHOOK_URL
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factura_id: id,
          numero: `${factura.prefijo ?? ''}${factura.numero ?? ''}`,
          cufe,
          qr_url,
          dian_estado,
        }),
      }).catch(() => null)
    }

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'documentos',
      registro_id: id,
      accion: 'UPDATE',
      datos_nuevos: { dian_estado, cufe, qr_url },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ ok: true, dian_estado, cufe, qr_url })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos para actualizar estado DIAN' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const estado = String(body?.dian_estado ?? '').trim()
    const cufe = body?.cufe ? String(body.cufe) : undefined
    const qr_url = body?.qr_url ? String(body.qr_url) : undefined

    if (!ESTADOS_DIAN.has(estado)) {
      return NextResponse.json({ error: 'Estado DIAN inválido' }, { status: 400 })
    }

    const payload: Record<string, unknown> = {
      dian_estado: estado,
      updated_at: new Date().toISOString(),
    }
    if (cufe !== undefined) payload.cufe = cufe
    if (qr_url !== undefined) payload.qr_url = qr_url

    const supabase = await createClient()
    const { error } = await supabase
      .from('documentos')
      .update(payload)
      .eq('id', id)
      .eq('tipo', 'factura_venta')
    if (error) throw error

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'documentos',
      registro_id: id,
      accion: 'UPDATE',
      datos_nuevos: payload,
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
