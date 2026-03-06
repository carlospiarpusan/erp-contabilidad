import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
