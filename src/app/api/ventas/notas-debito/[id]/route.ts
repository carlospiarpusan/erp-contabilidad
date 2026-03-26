import { NextRequest, NextResponse } from 'next/server'
import { getErrorStatus, toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { ACCOUNTING_ROLES } from '@/lib/auth/permissions'
import { registrarAuditoria } from '@/lib/auditoria'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('documentos')
      .select(`
        id, numero, prefijo, fecha, subtotal, total_iva, total_descuento, total,
        estado, motivo, observaciones, documento_origen_id,
        cliente:cliente_id(id, razon_social, numero_documento, tipo_documento, email, telefono, direccion),
        factura_origen:documento_origen_id(id, numero, prefijo, fecha),
        lineas:documentos_lineas(
          id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, total_iva, total,
          impuesto:impuesto_id(porcentaje)
        )
      `)
      .eq('id', id)
      .eq('tipo', 'nota_debito')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!(ACCOUNTING_ROLES as readonly string[]).includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos para anular notas' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (body?.accion !== 'anular') {
      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: result, error } = await supabase.rpc('secure_anular_nota_debito', {
      p_documento_id: id,
    })
    if (error) throw error

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'documentos',
      registro_id: id,
      accion: 'UPDATE',
      datos_nuevos: { tipo: 'nota_debito', estado: 'cancelada' },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json(result ?? { ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: getErrorStatus(e) })
  }
}
