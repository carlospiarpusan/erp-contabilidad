import { createClient } from '@/lib/supabase/server'

// ── Proveedores ──────────────────────────────────────────────────────────────

export async function getProveedores(params?: {
  busqueda?: string
  activo?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, activo, limit = 100, offset = 0 } = params ?? {}

  let q = supabase
    .from('proveedores')
    .select('*', { count: 'exact' })
    .order('razon_social')
    .range(offset, offset + limit - 1)

  if (activo !== undefined) q = q.eq('activo', activo)
  if (busqueda) q = q.ilike('razon_social', `%${busqueda}%`)

  const { data, count, error } = await q
  if (error) throw error
  return { proveedores: data ?? [], total: count ?? 0 }
}

export async function getProveedorById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createProveedor(proveedor: {
  razon_social: string
  contacto?: string
  tipo_documento?: string
  numero_documento?: string
  dv?: string
  email?: string
  telefono?: string
  whatsapp?: string
  direccion?: string
  ciudad?: string
  departamento?: string
  observaciones?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: uRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single()

  const { data, error } = await supabase
    .from('proveedores')
    .insert({ ...proveedor, empresa_id: uRow!.empresa_id, activo: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProveedor(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProveedor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('proveedores')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getResumenProveedor(proveedor_id: string) {
  const supabase = await createClient()
  const [facturasRes, recibosRes, ultimasRes] = await Promise.all([
    supabase.from('documentos').select('id, total, estado', { count: 'exact' })
      .eq('tipo', 'factura_compra').eq('proveedor_id', proveedor_id),
    supabase.from('recibos').select('valor')
      .eq('tipo', 'compra').eq('proveedor_id', proveedor_id),
    supabase.from('documentos')
      .select('id, numero, prefijo, total, fecha, estado')
      .eq('tipo', 'factura_compra').eq('proveedor_id', proveedor_id)
      .order('fecha', { ascending: false }).limit(5),
  ])
  const facturas       = facturasRes.data ?? []
  const total_facturas = facturasRes.count ?? 0
  const total_compras  = facturas.reduce((s, f) => s + (f.total ?? 0), 0)
  const total_pagado   = (recibosRes.data ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
  const saldo_pendiente = Math.max(0, total_compras - total_pagado)
  return { total_facturas, total_compras, total_pagado, saldo_pendiente, ultimas_facturas: ultimasRes.data ?? [] }
}

// ── Facturas Compra ──────────────────────────────────────────────────────────

export async function getEstadisticasCompras() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select('total, estado, fecha')
    .eq('tipo', 'factura_compra')
  if (error) throw error

  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]

  return {
    total:         data.length,
    total_monto:   data.reduce((s, r) => s + (r.total ?? 0), 0),
    pendiente:     data.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0),
    pagada:        data.filter(r => r.estado === 'pagada').reduce((s, r) => s + (r.total ?? 0), 0),
    este_mes:      data.filter(r => r.fecha >= primerDia).reduce((s, r) => s + (r.total ?? 0), 0),
  }
}

export async function getCompras(params?: {
  busqueda?:     string
  estado?:       string
  desde?:        string
  hasta?:        string
  proveedor_id?: string
  limit?:        number
  offset?:       number
}) {
  const supabase = await createClient()
  const { busqueda, estado, desde, hasta, proveedor_id, limit = 100, offset = 0 } = params ?? {}

  let q = supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, numero_externo,
      subtotal, total_iva, total_descuento, total, estado,
      proveedor:proveedor_id(id, razon_social),
      bodega:bodega_id(nombre)
    `, { count: 'exact' })
    .eq('tipo', 'factura_compra')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado)       q = q.eq('estado', estado)
  if (desde)        q = q.gte('fecha', desde)
  if (hasta)        q = q.lte('fecha', hasta)
  if (proveedor_id) q = q.eq('proveedor_id', proveedor_id)
  if (busqueda)     q = q.ilike('numero_externo', `%${busqueda}%`)

  const { data, count, error } = await q
  if (error) throw error
  return { compras: data ?? [], total: count ?? 0 }
}

export async function getCompraById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, numero_externo,
      subtotal, total_iva, total_descuento, total, estado, observaciones,
      proveedor:proveedor_id(razon_social, numero_documento, tipo_documento, email, telefono),
      bodega:bodega_id(nombre),
      lineas:documentos_lineas(
        id, descripcion, cantidad, precio_unitario, descuento_porcentaje,
        subtotal, total_iva, total,
        producto:producto_id(codigo, descripcion),
        impuesto:impuesto_id(porcentaje)
      ),
      recibos(id, numero, valor, fecha, observaciones, forma_pago:forma_pago_id(descripcion))
    `)
    .eq('id', id)
    .eq('tipo', 'factura_compra')
    .single()
  if (error) throw error
  return data
}

export async function createCompra(params: {
  empresa_id: string
  ejercicio_id: string
  proveedor_id: string
  bodega_id: string
  fecha: string
  numero_externo: string
  observaciones?: string
  lineas: {
    producto_id: string
    variante_id?: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento_porcentaje?: number
    impuesto_id?: string
  }[]
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_factura_compra', {
    p_empresa_id:    params.empresa_id,
    p_ejercicio_id:  params.ejercicio_id,
    p_proveedor_id:  params.proveedor_id,
    p_bodega_id:     params.bodega_id,
    p_fecha:         params.fecha,
    p_numero_externo: params.numero_externo,
    p_observaciones: params.observaciones ?? null,
    p_lineas:        params.lineas,
  })
  if (error) throw error
  return data as string
}

export async function cancelarCompra(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tipo', 'factura_compra')
  if (error) throw error
}

export async function pagarCompra(params: {
  empresa_id: string
  documento_id: string
  forma_pago_id: string
  ejercicio_id: string
  valor: number
  fecha: string
  observaciones?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_pago_compra', {
    p_empresa_id:    params.empresa_id,
    p_documento_id:  params.documento_id,
    p_forma_pago_id: params.forma_pago_id,
    p_ejercicio_id:  params.ejercicio_id,
    p_valor:         params.valor,
    p_fecha:         params.fecha,
    p_observaciones: params.observaciones ?? null,
  })
  if (error) throw error
  return data as string
}
