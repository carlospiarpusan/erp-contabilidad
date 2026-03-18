import { createClient } from '@/lib/supabase/server'
import { SELECT_DOC_HEADER, SELECT_DOC_LINEA, applyDateFilters } from './shared'

// ── Cotizaciones ─────────────────────────────────────────────────────────────

export async function getCotizaciones(params?: {
  busqueda?: string; estado?: string; desde?: string; hasta?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, estado, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  const q = applyDateFilters(
    supabase
      .from('documentos')
      .select(SELECT_DOC_HEADER, { count: 'exact' })
      .eq('tipo', 'cotizacion')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    { busqueda, estado, desde, hasta }
  )

  const { data, count, error } = await q
  if (error) throw error
  return { cotizaciones: data ?? [], total: count ?? 0 }
}

export async function getResumenCotizaciones(params?: {
  busqueda?: string; estado?: string; desde?: string; hasta?: string
}) {
  const supabase = await createClient()
  const filters = params ?? {}

  const [countRes, rowsRes] = await Promise.all([
    applyDateFilters(
      supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'cotizacion'),
      filters
    ),
    applyDateFilters(
      supabase
        .from('documentos')
        .select('estado, total')
        .eq('tipo', 'cotizacion'),
      filters
    ),
  ])

  if (countRes.error) throw countRes.error
  if (rowsRes.error) throw rowsRes.error

  const rows = rowsRes.data ?? []
  const aprobadas = rows.filter((row) => row.estado === 'aprobada')

  return {
    total: countRes.count ?? 0,
    total_valor: rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    aprobadas: aprobadas.length,
    valor_aprobado: aprobadas.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
  }
}

export async function getCotizacionById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`${SELECT_DOC_HEADER}, lineas:documentos_lineas(${SELECT_DOC_LINEA})`)
    .eq('id', id).eq('tipo', 'cotizacion').single()
  if (error) throw error
  return data
}

export async function createCotizacion(params: {
  ejercicio_id: string; cliente_id: string
  bodega_id: string; fecha: string; vencimiento: string
  observaciones?: string
  lineas: { producto_id: string; impuesto_id?: string; descripcion?: string; cantidad: number; precio_unitario: number; descuento_porcentaje?: number }[]
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_cotizacion', {
    p_ejercicio_id: params.ejercicio_id,
    p_cliente_id: params.cliente_id,
    p_bodega_id: params.bodega_id,
    p_fecha: params.fecha,
    p_vencimiento: params.vencimiento,
    p_observaciones: params.observaciones || null,
    p_lineas: JSON.stringify(params.lineas.map(l => ({ ...l, impuesto_id: l.impuesto_id || null }))),
  })
  if (error) throw error
  return data as string
}

export async function aprobarCotizacion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'cotizacion')
  if (error) throw error
}

export async function cancelarCotizacion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'cotizacion')
  if (error) throw error
}

export async function getEstadisticasCotizaciones() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos').select('estado, total').eq('tipo', 'cotizacion').neq('estado', 'cancelada')
  const rows = data ?? []
  return {
    total: rows.length,
    borrador: rows.filter(r => r.estado === 'borrador').length,
    aprobada: rows.filter(r => r.estado === 'aprobada').length,
    convertida: rows.filter(r => r.estado === 'convertida').length,
    valor: rows.filter(r => r.estado === 'aprobada').reduce((s, r) => s + (r.total ?? 0), 0),
  }
}

// ── Órdenes de Compra ─────────────────────────────────────────────────────────

const SELECT_ORDEN = `
  id, numero, prefijo, fecha, fecha_vencimiento, estado, subtotal, total_iva, total_descuento, total, observaciones, created_at,
  proveedor:proveedor_id(id, razon_social, numero_documento, email, telefono),
  bodega:bodega_id(id, nombre)
`

export async function getOrdenesCompra(params?: {
  busqueda?: string; estado?: string; desde?: string; hasta?: string
  limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, estado, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  let q = supabase
    .from('documentos')
    .select(SELECT_ORDEN, { count: 'exact' })
    .eq('tipo', 'orden_compra')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  if (busqueda) q = q.or(`numero::text.ilike.%${busqueda}%`)

  const { data, count, error } = await q
  if (error) throw error
  return { ordenes: data ?? [], total: count ?? 0 }
}

export async function getOrdenCompraById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`${SELECT_ORDEN}, lineas:documentos_lineas(${SELECT_DOC_LINEA})`)
    .eq('id', id).eq('tipo', 'orden_compra').single()
  if (error) throw error
  return data
}

export async function createOrdenCompra(params: {
  ejercicio_id: string; proveedor_id: string
  bodega_id: string; fecha: string; vencimiento: string
  observaciones?: string
  lineas: { producto_id: string; impuesto_id?: string; descripcion?: string; cantidad: number; precio_unitario: number; descuento_porcentaje?: number }[]
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_orden_compra', {
    p_ejercicio_id: params.ejercicio_id,
    p_proveedor_id: params.proveedor_id,
    p_bodega_id: params.bodega_id,
    p_fecha: params.fecha,
    p_vencimiento: params.vencimiento,
    p_observaciones: params.observaciones || null,
    p_lineas: JSON.stringify(params.lineas.map(l => ({ ...l, impuesto_id: l.impuesto_id || null }))),
  })
  if (error) throw error
  return data as string
}

export async function aprobarOrden(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'aprobada', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'orden_compra')
  if (error) throw error
}

export async function cancelarOrden(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'orden_compra')
  if (error) throw error
}

export async function getEstadisticasOrdenes() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos').select('estado, total').eq('tipo', 'orden_compra').neq('estado', 'cancelada')
  const rows = data ?? []
  return {
    total: rows.length,
    borrador: rows.filter(r => r.estado === 'borrador').length,
    aprobada: rows.filter(r => r.estado === 'aprobada').length,
    recibida: rows.filter(r => r.estado === 'recibida').length,
    valor: rows.reduce((s, r) => s + (r.total ?? 0), 0),
  }
}
