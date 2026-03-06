import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId, getEjercicioActivo } from '@/lib/db/maestros'

// Importación histórica de facturas de compra desde CSV.
// No mueve stock ni genera asiento (son datos históricos).
// El usuario puede luego usar "Generar Asientos Masivos" para contabilizarlas.
export async function POST(req: NextRequest) {
  try {
    const { filas } = await req.json()
    if (!Array.isArray(filas) || filas.length === 0) {
      return NextResponse.json({ error: 'No se recibieron filas' }, { status: 400 })
    }

    const [supabase, empresa_id, ejercicio] = await Promise.all([
      createClient(),
      getEmpresaId(),
      getEjercicioActivo(),
    ])

    if (!ejercicio) {
      return NextResponse.json({ error: 'No hay ejercicio contable activo' }, { status: 400 })
    }

    // Obtener serie de facturas de compra para consecutivo
    const { data: serie } = await supabase
      .from('series_documentos')
      .select('id, prefijo, consecutivo_actual')
      .eq('empresa_id', empresa_id)
      .eq('tipo', 'factura_compra')
      .single()

    // Cargar proveedores (para buscar por NIT)
    const { data: proveedores } = await supabase
      .from('proveedores')
      .select('id, numero_documento, razon_social')
      .eq('empresa_id', empresa_id)

    const mapaProveedores: Record<string, string> = {}
    for (const p of proveedores ?? []) {
      if (p.numero_documento) mapaProveedores[p.numero_documento.trim()] = p.id
    }

    const resultados = []
    let consecutivo = (serie?.consecutivo_actual ?? 0) + 1

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i] as Record<string, string>
      const fila = i + 2

      const nit_proveedor   = f.nit_proveedor?.trim()
      const numero_externo  = f.numero_externo?.trim()
      const fecha           = f.fecha?.trim()
      const descripcion     = f.descripcion?.trim() || 'Importado desde CSV'
      const total_str       = f.total?.trim().replace(/[^0-9.]/g, '')
      const subtotal_str    = f.subtotal?.trim().replace(/[^0-9.]/g, '')
      const iva_str         = f.iva?.trim().replace(/[^0-9.]/g, '')

      if (!nit_proveedor) {
        resultados.push({ fila, estado: 'error', mensaje: 'nit_proveedor es requerido' })
        continue
      }
      if (!numero_externo) {
        resultados.push({ fila, estado: 'error', mensaje: 'numero_externo es requerido' })
        continue
      }
      if (!fecha) {
        resultados.push({ fila, estado: 'error', mensaje: 'fecha es requerida (YYYY-MM-DD)' })
        continue
      }
      if (!total_str || isNaN(Number(total_str))) {
        resultados.push({ fila, estado: 'error', mensaje: 'total inválido' })
        continue
      }

      const proveedor_id = mapaProveedores[nit_proveedor]
      if (!proveedor_id) {
        resultados.push({ fila, estado: 'error', mensaje: `Proveedor con NIT ${nit_proveedor} no encontrado` })
        continue
      }

      const total    = Number(total_str)
      const total_iva = iva_str ? Number(iva_str) : 0
      const subtotal  = subtotal_str ? Number(subtotal_str) : total - total_iva

      const num = consecutivo
      const prefijo = serie?.prefijo ?? 'FC'

      // Insertar documento
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
          numero_externo,
          subtotal,
          total_iva,
          total_descuento: 0,
          total,
          observaciones: f.observaciones?.trim() || null,
        })
        .select('id')
        .single()

      if (docErr) {
        resultados.push({ fila, estado: 'error', mensaje: docErr.message })
        continue
      }

      // Insertar línea genérica
      const { error: lineaErr } = await supabase
        .from('documentos_lineas')
        .insert({
          documento_id: doc.id,
          descripcion,
          cantidad: 1,
          precio_unitario: subtotal,
          descuento_porcentaje: 0,
          subtotal,
          total_iva,
          total,
        })

      if (lineaErr) {
        // Rollback doc if line fails
        await supabase.from('documentos').delete().eq('id', doc.id)
        resultados.push({ fila, estado: 'error', mensaje: lineaErr.message })
        continue
      }

      // Actualizar consecutivo
      if (serie?.id) {
        await supabase
          .from('series_documentos')
          .update({ consecutivo_actual: num })
          .eq('id', serie.id)
      }
      consecutivo++

      resultados.push({ fila, estado: 'ok', mensaje: `${prefijo}${num}` })
    }

    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
