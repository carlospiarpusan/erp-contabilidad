import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revertirAsiento } from '@/lib/db/contabilidad'
import { registrarAuditoria } from '@/lib/auditoria'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('documentos')
      .select(`
        id, numero, prefijo, fecha, subtotal, total_iva, total_descuento, total, estado, motivo,
        observaciones, documento_origen_id,
        cliente:cliente_id(razon_social, numero_documento, tipo_documento, email, telefono, direccion),
        factura_origen:documento_origen_id(id, numero, prefijo, fecha),
        lineas:documentos_lineas(
          id, descripcion, cantidad, precio_unitario, descuento_porcentaje,
          subtotal, total_iva, total,
          producto:producto_id(codigo, descripcion),
          impuesto:impuesto_id(porcentaje)
        )
      `)
      .eq('id', id)
      .eq('tipo', 'nota_credito')
      .single()

    if (error || !data) return NextResponse.json({ error: 'Nota crédito no encontrada' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (!['admin', 'contador'].includes(session.rol)) {
      return NextResponse.json({ error: 'Sin permisos para anular notas' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    if (body?.accion !== 'anular') {
      return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: nota, error: notaErr } = await supabase
      .from('documentos')
      .select('id, numero, prefijo, estado')
      .eq('id', id)
      .eq('tipo', 'nota_credito')
      .single()

    if (notaErr || !nota) return NextResponse.json({ error: 'Nota crédito no encontrada' }, { status: 404 })
    if (nota.estado === 'cancelada') {
      return NextResponse.json({ ok: true, message: 'La nota ya estaba cancelada' })
    }

    const { error: updErr } = await supabase
      .from('documentos')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tipo', 'nota_credito')
    if (updErr) throw updErr

    let warning: string | null = null
    const { data: asiento } = await supabase
      .from('asientos')
      .select('id')
      .eq('documento_id', id)
      .eq('tipo_doc', 'nota_credito')
      .maybeSingle()

    if (asiento?.id) {
      try {
        await revertirAsiento(asiento.id as string, {
          allow_automatic: true,
          tipo_doc: 'reversion_nota_credito',
          concepto: `Reversión asiento nota crédito ${id}`,
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'No se pudo crear reversión contable'
        if (!msg.toLowerCase().includes('ya existe')) warning = msg
      }
    }

    await registrarAuditoria({
      empresa_id: session.empresa_id,
      usuario_id: session.id,
      tabla: 'documentos',
      registro_id: id,
      accion: 'UPDATE',
      datos_nuevos: { tipo: 'nota_credito', estado: 'cancelada' },
      ip: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ ok: true, warning })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
