import { createClient } from '@/lib/supabase/server'

// ── Estadísticas ─────────────────────────────────────────────

export async function getEstadisticasVentas() {
  const supabase = await createClient()
  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`

  const [totRes, pendRes, pagRes, mesRes] = await Promise.all([
    supabase.from('documentos').select('total', { count: 'exact' }).eq('tipo', 'factura_venta').neq('estado', 'cancelada'),
    supabase.from('documentos').select('total').eq('tipo', 'factura_venta').eq('estado', 'pendiente'),
    supabase.from('documentos').select('total').eq('tipo', 'factura_venta').eq('estado', 'pagada'),
    supabase.from('documentos').select('total').eq('tipo', 'factura_venta').neq('estado', 'cancelada').gte('fecha', inicioMes),
  ])

  const sumar = (rows: { total: number }[] | null) =>
    (rows ?? []).reduce((s, r) => s + (r.total ?? 0), 0)

  return {
    total:     totRes.count ?? 0,
    pendiente: sumar(pendRes.data as { total: number }[]),
    pagada:    sumar(pagRes.data as { total: number }[]),
    este_mes:  sumar(mesRes.data as { total: number }[]),
  }
}

// ── Listado ───────────────────────────────────────────────────

export async function getFacturas(params?: {
  busqueda?: string
  estado?:   string
  desde?:    string
  hasta?:    string
  limit?:    number
  offset?:   number
}) {
  const supabase = await createClient()
  const { busqueda, estado, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  let q = supabase
    .from('documentos')
    .select(`
      id, tipo, numero, prefijo, fecha, fecha_vencimiento,
      subtotal, total_iva, total_descuento, total, estado,
      observaciones, created_at,
      cliente:clientes(id, razon_social, numero_documento, tipo_documento),
      forma_pago:formas_pago(id, descripcion)
    `, { count: 'exact' })
    .eq('tipo', 'factura_venta')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado)    q = q.eq('estado', estado)
  if (desde)     q = q.gte('fecha', desde)
  if (hasta)     q = q.lte('fecha', hasta)
  if (busqueda)  q = q.or(
    `observaciones.ilike.%${busqueda}%`
  )

  const { data, error, count } = await q
  if (error) throw error
  return { facturas: data ?? [], total: count ?? 0 }
}

// ── Detalle ───────────────────────────────────────────────────

export async function getFacturaById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      *,
      cliente:clientes(id, razon_social, numero_documento, tipo_documento, dv, email, telefono, direccion, ciudad),
      forma_pago:formas_pago(id, descripcion, tipo),
      bodega:bodegas(id, nombre),
      colaborador:colaboradores(id, nombre),
      lineas:documentos_lineas(
        *,
        producto:productos(id, codigo, descripcion),
        impuesto:impuestos(id, descripcion, porcentaje)
      ),
      recibos(id, numero, valor, fecha, observaciones, forma_pago:formas_pago(descripcion))
    `)
    .eq('id', id)
    .eq('tipo', 'factura_venta')
    .single()
  if (error) throw error
  return data
}

// ── Crear (vía RPC atómico) ───────────────────────────────────

export async function createFactura(params: {
  empresa_id:     string
  ejercicio_id:   string
  cliente_id:     string
  bodega_id:      string
  forma_pago_id:  string
  colaborador_id: string | null
  fecha:          string
  fecha_vencimiento: string | null
  observaciones:  string | null
  lineas: Array<{
    producto_id:          string
    variante_id:          string | null
    descripcion:          string
    cantidad:             number
    precio_unitario:      number
    descuento_porcentaje: number
    impuesto_id:          string | null
  }>
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_factura_venta', {
    p_empresa_id:     params.empresa_id,
    p_ejercicio_id:   params.ejercicio_id,
    p_serie_tipo:     'factura_venta',
    p_cliente_id:     params.cliente_id,
    p_bodega_id:      params.bodega_id,
    p_forma_pago_id:  params.forma_pago_id,
    p_colaborador_id: params.colaborador_id,
    p_fecha:          params.fecha,
    p_vencimiento:    params.fecha_vencimiento,
    p_observaciones:  params.observaciones,
    p_lineas:         params.lineas,
  })
  if (error) throw error
  return data as string // returns the created document UUID
}

// ── Cancelar ─────────────────────────────────────────────────

export async function cancelarFactura(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tipo', 'factura_venta')
    .select('id')
    .single()
  if (error) throw error
  return data
}

// ── Recibos de caja ───────────────────────────────────────────

export async function getRecibos(params?: {
  documento_id?: string
  limit?:        number
  offset?:       number
}) {
  const supabase = await createClient()
  const { documento_id, limit = 50, offset = 0 } = params ?? {}

  let q = supabase
    .from('recibos')
    .select(`
      *,
      documento:documentos(id, numero, prefijo, total, cliente:clientes(razon_social)),
      forma_pago:formas_pago(descripcion)
    `, { count: 'exact' })
    .eq('tipo', 'venta')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (documento_id) q = q.eq('documento_id', documento_id)

  const { data, error, count } = await q
  if (error) throw error
  return { recibos: data ?? [], total: count ?? 0 }
}

export async function createRecibo(params: {
  empresa_id:    string
  ejercicio_id:  string
  documento_id:  string
  forma_pago_id: string
  valor:         number
  fecha:         string
  observaciones: string | null
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_recibo_venta', {
    p_empresa_id:    params.empresa_id,
    p_documento_id:  params.documento_id,
    p_forma_pago_id: params.forma_pago_id,
    p_ejercicio_id:  params.ejercicio_id,
    p_valor:         params.valor,
    p_fecha:         params.fecha,
    p_observaciones: params.observaciones,
  })
  if (error) throw error
  return data as string
}
