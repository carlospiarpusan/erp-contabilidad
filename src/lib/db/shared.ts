/** Selects y utilidades compartidas entre documentos de venta (pedidos, remisiones, cotizaciones) */

export const SELECT_DOC_HEADER = `
  id, numero, prefijo, fecha, fecha_vencimiento, estado, subtotal, total_iva, total_descuento, total, observaciones, created_at,
  cliente:cliente_id(id, razon_social, numero_documento, email, telefono),
  bodega:bodega_id(id, nombre)
`

export const SELECT_DOC_LINEA = `
  id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, total_iva, total,
  producto:producto_id(id, codigo, descripcion, precio_venta),
  impuesto:impuesto_id(id, descripcion, porcentaje)
`

type DateRangeFilters = {
  estado?: string
  desde?: string
  hasta?: string
  busqueda?: string
}

export function applyDateFilters<T>(query: T, params: DateRangeFilters) {
  let q = query as any
  if (params.estado) q = q.eq('estado', params.estado)
  if (params.desde) q = q.gte('fecha', params.desde)
  if (params.hasta) q = q.lte('fecha', params.hasta)
  if (params.busqueda) q = q.or(`numero::text.ilike.%${params.busqueda}%`)
  return q as T
}
