import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

// POST /api/documentos/duplicar { documento_id }
// Crea una copia del documento con fecha hoy, estado 'pendiente' o 'borrador'
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { documento_id } = await req.json()
    if (!documento_id) return NextResponse.json({ error: 'documento_id requerido' }, { status: 400 })

    const [supabase, empresa_id, ejercicio] = await Promise.all([
      createClient(),
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    if (!ejercicio) return NextResponse.json({ error: 'Sin ejercicio contable activo' }, { status: 400 })

    // Obtener documento original con líneas
    const { data: doc, error: docErr } = await supabase
      .from('documentos')
      .select('*, lineas:documentos_lineas(*)')
      .eq('id', documento_id)
      .eq('empresa_id', empresa_id)
      .single()

    if (docErr || !doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

    // Obtener consecutivo para el mismo tipo
    const { data: serie } = await supabase
      .from('series_documentos')
      .select('id, prefijo, consecutivo_actual')
      .eq('empresa_id', empresa_id)
      .eq('tipo', doc.tipo)
      .single()

    const num = (serie?.consecutivo_actual ?? 0) + 1
    const prefijo = serie?.prefijo ?? doc.prefijo ?? ''
    const hoy = new Date().toISOString().slice(0, 10)
    const estadoNuevo = doc.tipo === 'cotizacion' ? 'borrador' : 'pendiente'

    // Crear copia del documento
    const { data: nuevo, error: nuevoErr } = await supabase
      .from('documentos')
      .insert({
        empresa_id,
        ejercicio_id: ejercicio.id,
        tipo: doc.tipo,
        numero: num,
        prefijo,
        serie_id: serie?.id ?? doc.serie_id,
        fecha: hoy,
        estado: estadoNuevo,
        cliente_id: doc.cliente_id,
        proveedor_id: doc.proveedor_id,
        bodega_id: doc.bodega_id,
        forma_pago_id: doc.forma_pago_id,
        colaborador_id: doc.colaborador_id,
        subtotal: doc.subtotal,
        total_iva: doc.total_iva,
        total_descuento: doc.total_descuento,
        total: doc.total,
        observaciones: doc.observaciones,
      })
      .select('id')
      .single()

    if (nuevoErr || !nuevo) throw nuevoErr

    // Copiar líneas
    const lineas = (doc.lineas ?? []) as Array<Record<string, unknown>>
    for (const l of lineas) {
      await supabase.from('documentos_lineas').insert({
        documento_id: nuevo.id,
        producto_id: l.producto_id,
        variante_id: l.variante_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        precio_costo: l.precio_costo,
        descuento_porcentaje: l.descuento_porcentaje,
        impuesto_id: l.impuesto_id,
        subtotal: l.subtotal,
        total_descuento: l.total_descuento,
        total_iva: l.total_iva,
        total: l.total,
      })
    }

    // Actualizar consecutivo
    if (serie?.id) {
      await supabase.from('series_documentos').update({ consecutivo_actual: num }).eq('id', serie.id)
    }

    return NextResponse.json({ id: nuevo.id, tipo: doc.tipo }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
