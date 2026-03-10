import { createClient } from '@/lib/supabase/server'
import { getEjercicioActivo, getEmpresaId, getFormasPago } from '@/lib/db/maestros'
import { calcularFechaPagoSistecredito, isSistecreditoFormaPago } from '@/lib/utils/formas-pago'
import { parseDocumentSearchTerm, sanitizeSearchTerm } from '@/lib/utils/search'

export interface FormaPagoRecaudoVenta {
  id: string
  descripcion: string
}

export interface SistecreditoFacturaPendiente {
  id: string
  numero: string
  fecha: string
  fecha_cobro_esperada: string
  estado: string
  cliente: string
  total: number
  pagado: number
  saldo: number
}

export interface SistecreditoMesPendiente {
  mes_venta: string
  etiqueta_mes: string
  fecha_cobro_esperada: string
  facturas: number
  total: number
  pagado: number
  saldo: number
  detalle: SistecreditoFacturaPendiente[]
}

export interface AplicarPagoMensualSistecreditoResult {
  mes_venta: string
  fecha_pago: string
  facturas: number
  total: number
  recibos: string[]
}

const FACTURAS_SELECT = `
  id, tipo, numero, prefijo, fecha, fecha_vencimiento, cliente_id,
  subtotal, total_iva, total_descuento, total, estado,
  observaciones, created_at,
  cliente:clientes(id, razon_social, numero_documento, tipo_documento),
  forma_pago:formas_pago(id, descripcion)
`

function applyFacturaFilters(
  query: any,
  params: {
    estado?: string
    desde?: string
    hasta?: string
    cliente_id?: string
  }
) {
  if (params.estado) query = query.eq('estado', params.estado)
  if (params.desde) query = query.gte('fecha', params.desde)
  if (params.hasta) query = query.lte('fecha', params.hasta)
  if (params.cliente_id) query = query.eq('cliente_id', params.cliente_id)
  return query
}

function sortFacturas<T extends { fecha?: string | null; numero?: number | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const fechaDiff = String(b.fecha ?? '').localeCompare(String(a.fecha ?? ''))
    if (fechaDiff !== 0) return fechaDiff
    return Number(b.numero ?? 0) - Number(a.numero ?? 0)
  })
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values())
}

function buildFacturaSearchClause(params: {
  textTerm: string
  clientIds: string[]
  numericValue: number | null
}) {
  const clauses: string[] = []

  if (params.numericValue !== null) {
    clauses.push(`numero.eq.${params.numericValue}`)
  }

  if (params.textTerm) {
    clauses.push(`prefijo.ilike.%${params.textTerm}%`)
    clauses.push(`observaciones.ilike.%${params.textTerm}%`)
  }

  if (params.clientIds.length > 0) {
    clauses.push(`cliente_id.in.(${params.clientIds.join(',')})`)
  }

  return clauses.join(',')
}

function monthKeyFromDate(fecha: string) {
  return `${fecha.slice(0, 7)}-01`
}

function formatMonthLabel(monthKey: string) {
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monthKey}T12:00:00`))

  return label.charAt(0).toUpperCase() + label.slice(1)
}

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
    total: totRes.count ?? 0,
    pendiente: sumar(pendRes.data as { total: number }[]),
    pagada: sumar(pagRes.data as { total: number }[]),
    este_mes: sumar(mesRes.data as { total: number }[]),
  }
}

// ── Listado ───────────────────────────────────────────────────

export async function getFacturas(params?: {
  busqueda?: string
  estado?: string
  desde?: string
  hasta?: string
  cliente_id?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, estado, desde, hasta, cliente_id, limit = 50, offset = 0 } = params ?? {}
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const safeOffset = Math.max(0, offset)
  const searchTerm = busqueda?.trim()

  const baseQuery = () =>
    applyFacturaFilters(
      supabase
        .from('documentos')
        .select(FACTURAS_SELECT)
        .eq('tipo', 'factura_venta')
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false }),
      { estado, desde, hasta, cliente_id }
    )

  if (!searchTerm) {
    const { data, error, count } = await applyFacturaFilters(
      supabase
        .from('documentos')
        .select(FACTURAS_SELECT, { count: 'exact' })
        .eq('tipo', 'factura_venta')
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1),
      { estado, desde, hasta, cliente_id }
    )
    if (error) throw error
    return { facturas: data ?? [], total: count ?? 0 }
  }

  const parsed = parseDocumentSearchTerm(searchTerm)
  const textTerm = sanitizeSearchTerm(searchTerm)

  let clienteIds: string[] = []
  if (textTerm && !cliente_id) {
    const { data: clientesData, error: clientesError } = await supabase
      .from('clientes')
      .select('id')
      .or(`razon_social.ilike.%${textTerm}%,numero_documento.ilike.%${textTerm}%,email.ilike.%${textTerm}%,telefono.ilike.%${textTerm}%`)
      .limit(200)
    if (clientesError) throw clientesError
    clienteIds = (clientesData ?? []).map((row) => row.id).filter(Boolean)
  }

  if (parsed.numericValue !== null && parsed.prefix) {
    const { data, error, count } = await applyFacturaFilters(
      supabase
        .from('documentos')
        .select(FACTURAS_SELECT, { count: 'exact' })
        .eq('tipo', 'factura_venta')
        .eq('numero', parsed.numericValue)
        .ilike('prefijo', `%${parsed.prefix}%`)
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(safeOffset, safeOffset + safeLimit - 1),
      { estado, desde, hasta, cliente_id }
    )
    if (error) throw error
    return { facturas: data ?? [], total: count ?? 0 }
  }

  const searchClause = buildFacturaSearchClause({
    textTerm,
    clientIds: clienteIds,
    numericValue: parsed.numericValue,
  })

  if (!searchClause) {
    return { facturas: [], total: 0 }
  }

  const { data, error, count } = await applyFacturaFilters(
    supabase
      .from('documentos')
      .select(FACTURAS_SELECT, { count: 'exact' })
      .eq('tipo', 'factura_venta')
      .or(searchClause)
      .order('fecha', { ascending: false })
      .order('numero', { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1),
    { estado, desde, hasta, cliente_id }
  )

  if (error) throw error

  return {
    facturas: sortFacturas(
      dedupeById((data ?? []) as Array<{ id: string; fecha?: string | null; numero?: number | null }>)
    ),
    total: count ?? 0,
  }
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
  empresa_id: string
  ejercicio_id: string
  cliente_id: string
  bodega_id: string
  forma_pago_id: string
  colaborador_id: string | null
  fecha: string
  fecha_vencimiento: string | null
  observaciones: string | null
  lineas: Array<{
    producto_id: string
    variante_id: string | null
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento_porcentaje: number
    impuesto_id: string | null
  }>
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('secure_crear_factura_venta', {
    p_ejercicio_id: params.ejercicio_id,
    p_serie_tipo: 'factura_venta',
    p_cliente_id: params.cliente_id,
    p_bodega_id: params.bodega_id,
    p_forma_pago_id: params.forma_pago_id,
    p_colaborador_id: params.colaborador_id || null,
    p_fecha: params.fecha,
    p_vencimiento: params.fecha_vencimiento,
    p_observaciones: params.observaciones || null,
    p_lineas: params.lineas.map(l => ({
      ...l,
      variante_id: l.variante_id || null,
      impuesto_id: l.impuesto_id || null
    })),
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
  desde?: string
  hasta?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { documento_id, desde, hasta, limit = 50, offset = 0 } = params ?? {}

  let q = supabase
    .from('recibos')
    .select(`
      *,
      documento:documentos(id, numero, prefijo, total, cliente:clientes(razon_social)),
      forma_pago:formas_pago(descripcion)
    `, { count: 'exact' })
    .eq('tipo', 'venta')
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1)

  if (documento_id) q = q.eq('documento_id', documento_id)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)

  const { data, error, count } = await q
  if (error) throw error
  return { recibos: data ?? [], total: count ?? 0 }
}

export async function getReciboById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recibos')
    .select(`
      *,
      documento:documentos(id, numero, prefijo, total, fecha,
        cliente:clientes(razon_social, numero_documento, tipo_documento, email, telefono)
      ),
      forma_pago:formas_pago(id, descripcion)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createRecibo(params: {
  empresa_id: string
  ejercicio_id: string
  documento_id: string
  forma_pago_id: string
  valor: number
  fecha: string
  observaciones: string | null
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('secure_crear_recibo_venta', {
    p_documento_id: params.documento_id,
    p_forma_pago_id: params.forma_pago_id,
    p_ejercicio_id: params.ejercicio_id,
    p_valor: params.valor,
    p_fecha: params.fecha,
    p_observaciones: params.observaciones || null,
  })
  if (error) throw error
  return data as string
}

export async function getFormasPagoRecaudoVentas(): Promise<FormaPagoRecaudoVenta[]> {
  const formas = await getFormasPago()
  return formas
    .filter((forma) => !isSistecreditoFormaPago(forma as { descripcion?: string | null }))
    .map((forma) => ({
      id: forma.id,
      descripcion: forma.descripcion ?? 'Sin descripción',
    }))
}

export async function getSistecreditoPendientesPorMes(): Promise<SistecreditoMesPendiente[]> {
  const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, total, estado,
      cliente:cliente_id(razon_social),
      forma_pago:forma_pago_id(descripcion),
      recibos(valor)
    `)
    .eq('empresa_id', empresa_id)
    .eq('tipo', 'factura_venta')
    .in('estado', ['pendiente', 'vencida'])
    .order('fecha', { ascending: true })
    .order('numero', { ascending: true })

  if (error) throw error

  const grouped = new Map<string, SistecreditoMesPendiente>()

  for (const row of data ?? []) {
    const formaPago = row.forma_pago as { descripcion?: string | null } | null
    if (!isSistecreditoFormaPago(formaPago)) continue

    const total = Number(row.total ?? 0)
    const pagado = (row.recibos ?? []).reduce((sum, recibo) => sum + Number(recibo.valor ?? 0), 0)
    const saldo = Math.max(0, total - pagado)
    if (saldo <= 0.01 || !row.fecha) continue

    const mesVenta = monthKeyFromDate(row.fecha)
    const numero = `${row.prefijo ?? ''}${row.numero ?? ''}`
    const factura: SistecreditoFacturaPendiente = {
      id: row.id,
      numero,
      fecha: row.fecha,
      fecha_cobro_esperada: calcularFechaPagoSistecredito(row.fecha),
      estado: row.estado ?? 'pendiente',
      cliente: ((Array.isArray(row.cliente) ? row.cliente[0] : row.cliente) as { razon_social?: string | null } | null)?.razon_social ?? 'Sin cliente',
      total,
      pagado,
      saldo,
    }

    const current = grouped.get(mesVenta)
    if (!current) {
      grouped.set(mesVenta, {
        mes_venta: mesVenta,
        etiqueta_mes: formatMonthLabel(mesVenta),
        fecha_cobro_esperada: calcularFechaPagoSistecredito(row.fecha),
        facturas: 1,
        total,
        pagado,
        saldo,
        detalle: [factura],
      })
      continue
    }

    current.facturas += 1
    current.total += total
    current.pagado += pagado
    current.saldo += saldo
    current.detalle.push(factura)
  }

  return Array.from(grouped.values()).sort((a, b) => a.mes_venta.localeCompare(b.mes_venta))
}

export async function aplicarPagoMensualSistecredito(params: {
  mes_venta: string
  forma_pago_id: string
  fecha_pago?: string
  observaciones?: string | null
}): Promise<AplicarPagoMensualSistecreditoResult> {
  const supabase = await createClient()
  const ejercicio = await getEjercicioActivo()
  const fecha_pago = params.fecha_pago || calcularFechaPagoSistecredito(`${params.mes_venta.slice(0, 7)}-01`)

  const { data, error } = await supabase.rpc('secure_aplicar_pago_mensual_sistecredito', {
    p_mes_venta: `${params.mes_venta.slice(0, 7)}-01`,
    p_forma_pago_id: params.forma_pago_id,
    p_ejercicio_id: ejercicio.id,
    p_fecha_pago: fecha_pago,
    p_observaciones: params.observaciones || null,
  })

  if (error) throw error

  const result = (data ?? {}) as Partial<AplicarPagoMensualSistecreditoResult>
  return {
    mes_venta: result.mes_venta ?? params.mes_venta.slice(0, 7),
    fecha_pago: result.fecha_pago ?? fecha_pago,
    facturas: Number(result.facturas ?? 0),
    total: Number(result.total ?? 0),
    recibos: Array.isArray(result.recibos) ? result.recibos.map(String) : [],
  }
}
