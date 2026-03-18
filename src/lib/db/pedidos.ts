import { createClient } from '@/lib/supabase/server'
import { SELECT_DOC_HEADER, SELECT_DOC_LINEA, applyDateFilters } from './shared'

export async function getPedidos(params?: {
  estado?: string; desde?: string; hasta?: string; limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { estado, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  const q = applyDateFilters(
    supabase
      .from('documentos')
      .select(SELECT_DOC_HEADER, { count: 'exact' })
      .eq('tipo', 'pedido')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    { estado, desde, hasta }
  )

  const { data, count, error } = await q
  if (error) throw error
  return { pedidos: data ?? [], total: count ?? 0 }
}

export async function getResumenPedidos(params?: {
  estado?: string; desde?: string; hasta?: string
}) {
  const supabase = await createClient()
  const filters = params ?? {}

  const [countRes, rowsRes] = await Promise.all([
    applyDateFilters(
      supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
        .eq('tipo', 'pedido'),
      filters
    ),
    applyDateFilters(
      supabase
        .from('documentos')
        .select('estado, total')
        .eq('tipo', 'pedido'),
      filters
    ),
  ])

  if (countRes.error) throw countRes.error
  if (rowsRes.error) throw rowsRes.error

  const rows = rowsRes.data ?? []
  const aprobados = rows.filter((row) => row.estado === 'aprobado')

  return {
    total: countRes.count ?? 0,
    total_valor: rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    aprobados: aprobados.length,
    valor_aprobados: aprobados.reduce((sum, row) => sum + Number(row.total ?? 0), 0),
  }
}

export async function getPedidoById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`${SELECT_DOC_HEADER}, lineas:documentos_lineas(${SELECT_DOC_LINEA})`)
    .eq('id', id).eq('tipo', 'pedido').single()
  if (error) throw error
  return data
}

export async function createPedido(params: {
  ejercicio_id: string; cliente_id: string
  bodega_id: string; fecha: string; vencimiento: string
  observaciones?: string
  lineas: { producto_id: string; impuesto_id?: string; descripcion?: string; cantidad: number; precio_unitario: number; descuento_porcentaje?: number }[]
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_pedido', {
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
