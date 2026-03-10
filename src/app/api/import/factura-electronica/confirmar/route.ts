import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

interface LineaConfirmada {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  iva: number
  total: number
  // Opciones de producto:
  accion: 'usar_existente' | 'crear_nuevo' | 'sin_producto'
  producto_id?: string | null        // si accion = usar_existente
  nuevo_codigo?: string              // si accion = crear_nuevo
  nueva_descripcion?: string         // si accion = crear_nuevo
  nuevo_precio_venta?: number        // si accion = crear_nuevo
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await req.json()
    const {
      proveedor_id,
      bodega_id,
      fecha,
      numero_externo,
      observaciones,
      lineas,
    }: {
      proveedor_id: string
      bodega_id: string
      fecha: string
      numero_externo: string
      observaciones?: string
      lineas: LineaConfirmada[]
    } = body

    if (!proveedor_id) return NextResponse.json({ error: 'proveedor_id requerido' }, { status: 400 })
    if (!bodega_id)    return NextResponse.json({ error: 'bodega_id requerido' }, { status: 400 })
    if (!numero_externo) return NextResponse.json({ error: 'numero_externo requerido' }, { status: 400 })
    if (!lineas?.length) return NextResponse.json({ error: 'Se requiere al menos una línea' }, { status: 400 })

    const [supabase, empresa_id, ejercicio] = await Promise.all([
      createClient(),
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    if (!ejercicio) return NextResponse.json({ error: 'Sin ejercicio contable activo' }, { status: 400 })

    // ── 1. Crear productos nuevos si aplica ───────────────────────────────────
    const lineas_procesadas: {
      producto_id: string | null
      descripcion: string
      cantidad: number
      precio_unitario: number
      impuesto_id: string | null
      descuento_porcentaje: number
    }[] = []

    for (const l of lineas) {
      let producto_id: string | null = null

      if (l.accion === 'usar_existente' && l.producto_id) {
        producto_id = l.producto_id
        // Actualizar precio de compra del producto existente
        await supabase
          .from('productos')
          .update({ precio_compra: l.precio_unitario, updated_at: new Date().toISOString() })
          .eq('id', producto_id)

      } else if (l.accion === 'crear_nuevo') {
        const codigo = (l.nuevo_codigo ?? '').trim()
        const descripcion = (l.nueva_descripcion ?? l.descripcion).trim()
        if (!codigo) {
          return NextResponse.json({ error: `Línea "${l.descripcion}": falta el código para el nuevo producto` }, { status: 400 })
        }

        const { data: nuevo, error: errProd } = await supabase
          .from('productos')
          .insert({
            empresa_id,
            codigo,
            descripcion,
            precio_venta: l.nuevo_precio_venta ?? l.precio_unitario,
            precio_compra: l.precio_unitario,
            activo: true,
          })
          .select('id')
          .single()

        if (errProd) {
          return NextResponse.json({ error: `Error al crear producto "${codigo}": ${errProd.message}` }, { status: 400 })
        }
        producto_id = nuevo.id
      }
      // accion = 'sin_producto': producto_id queda null

      lineas_procesadas.push({
        producto_id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        impuesto_id: null,
        descuento_porcentaje: 0,
      })
    }

    // ── 2. Usar función SQL para crear factura + stock + asiento ──────────────
    // Solo para las líneas CON producto_id podemos usar la función completa.
    // Líneas sin producto se insertan directamente.
    const lineas_con_producto = lineas_procesadas.filter(l => l.producto_id)
    const lineas_sin_producto = lineas_procesadas.filter(l => !l.producto_id)

    let doc_id: string

    if (lineas_con_producto.length > 0) {
      // Crear vía función SQL (mueve stock + genera asiento)
      const { data, error } = await supabase.rpc('secure_crear_factura_compra', {
        p_ejercicio_id: ejercicio.id,
        p_proveedor_id: proveedor_id,
        p_bodega_id: bodega_id,
        p_fecha: fecha,
        p_numero_externo: numero_externo,
        p_observaciones: observaciones || null,
        p_lineas: lineas_con_producto.map(l => ({
          producto_id: l.producto_id,
          variante_id: null,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_porcentaje: 0,
          impuesto_id: null,
        })),
      })
      if (error) throw error
      doc_id = data as string

      // Si hay líneas sin producto, agregarlas manualmente
      if (lineas_sin_producto.length > 0) {
        for (const l of lineas_sin_producto) {
          const sub = l.cantidad * l.precio_unitario
          await supabase.from('documentos_lineas').insert({
            documento_id: doc_id,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento_porcentaje: 0,
            subtotal: sub,
            total_iva: 0,
            total: sub,
          })
        }
      }
    } else {
      // Sin productos: crear documento manualmente
      const total    = lineas_procesadas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0)

      // Consecutivo
      const { data: serie } = await supabase
        .from('series_documentos')
        .select('id, prefijo, consecutivo_actual')
        .eq('empresa_id', empresa_id)
        .eq('tipo', 'factura_compra')
        .single()

      const num = (serie?.consecutivo_actual ?? 0) + 1
      const prefijo = serie?.prefijo ?? 'FC'

      const { data: doc, error: docErr } = await supabase
        .from('documentos')
        .insert({
          empresa_id,
          ejercicio_id: ejercicio.id,
          tipo: 'factura_compra',
          numero: num,
          prefijo,
          fecha,
          estado: 'pendiente',
          proveedor_id,
          bodega_id,
          numero_externo,
          subtotal: total,
          total_iva: 0,
          total_descuento: 0,
          total,
          observaciones: observaciones || null,
        })
        .select('id')
        .single()

      if (docErr) throw docErr
      doc_id = doc.id

      for (const l of lineas_procesadas) {
        const sub = l.cantidad * l.precio_unitario
        await supabase.from('documentos_lineas').insert({
          documento_id: doc_id,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          descuento_porcentaje: 0,
          subtotal: sub,
          total_iva: 0,
          total: sub,
        })
      }

      if (serie?.id) {
        await supabase.from('series_documentos').update({ consecutivo_actual: num }).eq('id', serie.id)
      }
    }

    return NextResponse.json({ ok: true, id: doc_id })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
