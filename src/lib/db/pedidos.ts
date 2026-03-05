import { createClient } from '@/lib/supabase/server'

const SELECT_PEDIDO = `
  id, numero, prefijo, fecha, fecha_vencimiento, estado, subtotal, total_iva, total_descuento, total, observaciones, created_at,
  cliente:cliente_id(id, razon_social, numero_documento, email, telefono),
  bodega:bodega_id(id, nombre)
`
const SELECT_LINEA = `
  id, descripcion, cantidad, precio_unitario, descuento_porcentaje, subtotal, total_iva, total,
  producto:producto_id(id, codigo, descripcion, precio_venta),
  impuesto:impuesto_id(id, descripcion, porcentaje)
`

export async function getPedidos(params?: {
  estado?: string; desde?: string; hasta?: string; limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { estado, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  let q = supabase
    .from('documentos')
    .select(SELECT_PEDIDO, { count: 'exact' })
    .eq('tipo', 'pedido')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data, count, error } = await q
  if (error) throw error
  return { pedidos: data ?? [], total: count ?? 0 }
}

export async function getPedidoById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`${SELECT_PEDIDO}, lineas:documentos_lineas(${SELECT_LINEA})`)
    .eq('id', id).eq('tipo', 'pedido').single()
  if (error) throw error
  return data
}

export async function createPedido(params: {
  empresa_id: string; ejercicio_id: string; cliente_id: string
  bodega_id: string; fecha: string; vencimiento: string
  observaciones?: string
  lineas: { producto_id: string; impuesto_id?: string; descripcion?: string; cantidad: number; precio_unitario: number; descuento_porcentaje?: number }[]
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_empresa_id: params.empresa_id,
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

export async function updateEstadoPedido(id: string, estado: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'pedido')
  if (error) throw error
}

export async function getEstadisticasPedidos() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos').select('estado, total').eq('tipo', 'pedido').neq('estado', 'cancelado')
  const rows = data ?? []
  return {
    total: rows.length,
    pendiente: rows.filter(r => r.estado === 'pendiente').length,
    en_proceso: rows.filter(r => r.estado === 'en_proceso').length,
    despachado: rows.filter(r => r.estado === 'despachado').length,
    valor: rows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0),
  }
}
