import { createClient } from '@/lib/supabase/server'
import { cleanUUIDs } from '@/lib/utils/db'
import { getEmpresaId } from '@/lib/db/maestros'
import { sanitizeSearchTerm } from '@/lib/utils/search'
import { assertDocumentoCancelacionPermitida } from '@/lib/db/documentos-contables'

function isMissingRpcSignature(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = String((error as { message?: string }).message ?? '')
  return message.includes('Could not find the function public.secure_crear_pago_compra') ||
    message.includes('function public.secure_crear_pago_compra')
}

const COMPRA_DETAIL_SELECT_FULL = `
      id, numero, prefijo, fecha, numero_externo,
      subtotal, total_iva, total_descuento, total, estado, observaciones,
      documento_soporte_requerido, documento_soporte_estado, proveedor_id,
      proveedor:proveedor_id(id, razon_social, numero_documento, tipo_documento, email, telefono, obligado_a_facturar),
      bodega:bodega_id(nombre),
      lineas:documentos_lineas(
        id, descripcion, cantidad, precio_unitario, descuento_porcentaje,
        subtotal, total_descuento, total_iva, total,
        producto:producto_id(codigo, descripcion),
        impuesto:impuesto_id(porcentaje)
      ),
      recibos(id, numero, valor, fecha, observaciones, forma_pago:forma_pago_id(descripcion))
    `

const COMPRA_DETAIL_SELECT_LEGACY = `
      id, numero, prefijo, fecha, numero_externo,
      subtotal, total_iva, total_descuento, total, estado, observaciones,
      proveedor_id,
      proveedor:proveedor_id(id, razon_social, numero_documento, tipo_documento, email, telefono),
      bodega:bodega_id(nombre),
      lineas:documentos_lineas(
        id, descripcion, cantidad, precio_unitario, descuento_porcentaje,
        subtotal, total_descuento, total_iva, total,
        producto:producto_id(codigo, descripcion),
        impuesto:impuesto_id(porcentaje)
      ),
      recibos(id, numero, valor, fecha, observaciones, forma_pago:forma_pago_id(descripcion))
    `

function isMissingColumnError(error: unknown) {
  if (typeof error !== 'object' || error === null) return false
  const code = String((error as { code?: string }).code ?? '')
  const message = String((error as { message?: string }).message ?? '')
  return code === '42703' || message.includes('does not exist')
}

// ── Proveedores ──────────────────────────────────────────────────────────────

const PROVEEDORES_SELECT_FULL = '*'
const PROVEEDORES_SELECT_SELECTOR = 'id, razon_social, numero_documento, activo, obligado_a_facturar'

export async function getProveedores(params?: {
  busqueda?: string
  activo?: boolean
  limit?: number
  offset?: number
  select_mode?: 'full' | 'selector'
  include_total?: boolean
}) {
  const supabase = await createClient()
  const { busqueda, activo, limit = 100, offset = 0, select_mode = 'full', include_total } = params ?? {}

  const needsTotal = include_total ?? select_mode === 'full'
  const fields = select_mode === 'selector' ? PROVEEDORES_SELECT_SELECTOR : PROVEEDORES_SELECT_FULL

  const applyFilters = (query: any) => {
    if (activo !== undefined) query = query.eq('activo', activo)
    if (busqueda) {
      const term = sanitizeSearchTerm(busqueda)
      if (term) {
        query = query.or(
          `razon_social.ilike.%${term}%,numero_documento.ilike.%${term}%,contacto.ilike.%${term}%,email.ilike.%${term}%,telefono.ilike.%${term}%`
        )
      }
    }
    return query
  }

  const dataQuery = applyFilters(
    supabase
    .from('proveedores')
    .select(fields)
    .order('razon_social')
    .range(offset, offset + limit - 1)
  )

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    needsTotal
      ? applyFilters(
        supabase
          .from('proveedores')
          .select('id', { count: 'exact', head: true })
      )
      : Promise.resolve(null),
  ])

  if (dataRes.error) throw dataRes.error
  if (countRes?.error) throw countRes.error

  const proveedores = dataRes.data ?? []
  const total = needsTotal ? (countRes?.count ?? 0) : proveedores.length
  return { proveedores, total }
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
  obligado_a_facturar?: boolean
}) {
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...proveedor, empresa_id, activo: true })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProveedor(id: string, fields: Record<string, unknown>) {
  const { id: _id, empresa_id: _eid, created_at: _ca, updated_at: _ua, ...rest } = fields as Record<string, unknown>
  const payload = cleanUUIDs(rest)

  const supabase = await createClient()
  const { error } = await supabase
    .from('proveedores')
    .update(payload)
    .eq('id', id)
  if (error) throw new Error(error.message ?? 'Error al actualizar proveedor')

  const { data, error: fetchError } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw new Error(fetchError.message ?? 'Error al obtener proveedor actualizado')
  return data
}

export async function deleteProveedor(id: string) {
  const supabase = await createClient()

  const { error: deleteError } = await supabase
    .from('proveedores')
    .delete()
    .eq('id', id)

  if (!deleteError) {
    return { mode: 'deleted' as const }
  }

  if (deleteError.code === '23503') {
    const { data, error: updateError } = await supabase
      .from('proveedores')
      .update({ activo: false })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) throw new Error(updateError.message ?? 'Error al desactivar proveedor')

    return {
      mode: 'deactivated' as const,
      proveedor: data,
      message: 'El proveedor tiene movimientos relacionados y fue desactivado en lugar de eliminarse.',
    }
  }

  throw new Error(deleteError.message ?? 'Error al eliminar proveedor')
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
  const facturas = facturasRes.data ?? []
  const total_facturas = facturasRes.count ?? 0
  const total_compras = facturas.reduce((s, f) => s + (f.total ?? 0), 0)
  const total_pagado = (recibosRes.data ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
  const saldo_pendiente = Math.max(0, total_compras - total_pagado)
  return { total_facturas, total_compras, total_pagado, saldo_pendiente, ultimas_facturas: ultimasRes.data ?? [] }
}

// ── Facturas Compra ──────────────────────────────────────────────────────────

export async function getEstadisticasCompras() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos').select('total, estado, fecha').eq('tipo', 'factura_compra')
  if (error) throw error

  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]

  return {
    total: data.length,
    total_monto: data.reduce((s, r) => s + (r.total ?? 0), 0),
    pendiente: data.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0),
    pagada: data.filter(r => r.estado === 'pagada').reduce((s, r) => s + (r.total ?? 0), 0),
    este_mes: data.filter(r => r.fecha >= primerDia).reduce((s, r) => s + (r.total ?? 0), 0),
  }
}

export async function getCompras(params?: {
  busqueda?: string
  estado?: string
  desde?: string
  hasta?: string
  proveedor_id?: string
  limit?: number
  offset?: number
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
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .range(offset, offset + limit - 1)

  if (estado) q = q.eq('estado', estado)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  if (proveedor_id) q = q.eq('proveedor_id', proveedor_id)
  if (busqueda) q = q.ilike('numero_externo', `%${busqueda}%`)

  const { data, count, error } = await q
  if (error) throw error
  return { compras: data ?? [], total: count ?? 0 }
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export async function getRecibosCompraContables(params?: { limit?: number }) {
  const supabase = await createClient()
  const limit = Math.max(1, Math.min(params?.limit ?? 100, 200))

  const { data, error } = await supabase
    .from('recibos')
    .select(`
      id,
      numero,
      fecha,
      valor,
      observaciones,
      documento:documento_id(
        id,
        numero,
        prefijo,
        numero_externo,
        proveedor:proveedor_id(id, razon_social, numero_documento)
      ),
      forma_pago:forma_pago_id(id, descripcion)
    `)
    .eq('tipo', 'compra')
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map((item) => {
    const documento = (item.documento ?? null) as {
      id?: string
      numero?: number
      prefijo?: string | null
      numero_externo?: string | null
      proveedor?: {
        id?: string
        razon_social?: string
        numero_documento?: string
      } | null
    } | null

    const formaPago = (item.forma_pago ?? null) as { id?: string; descripcion?: string } | null

    return {
      id: String(item.id),
      numero: Number(item.numero ?? 0),
      fecha: String(item.fecha),
      valor: Number(item.valor ?? 0),
      observaciones: item.observaciones ?? null,
      documento: documento
        ? {
          id: documento.id ? String(documento.id) : '',
          numero: Number(documento.numero ?? 0),
          prefijo: documento.prefijo ?? '',
          numero_externo: documento.numero_externo ?? null,
          proveedor: documento.proveedor
            ? {
              id: documento.proveedor.id ? String(documento.proveedor.id) : '',
              razon_social: documento.proveedor.razon_social ?? '',
              numero_documento: documento.proveedor.numero_documento ?? '',
            }
            : null,
        }
        : null,
      forma_pago: formaPago
        ? {
          id: formaPago.id ? String(formaPago.id) : '',
          descripcion: formaPago.descripcion ?? '',
        }
        : null,
    }
  })
}

export async function getFacturasCompraPendientesPago(params?: {
  limit?: number
  busqueda?: string
}) {
  const supabase = await createClient()
  const limit = Math.max(1, Math.min(params?.limit ?? 200, 300))
  const term = sanitizeSearchTerm(params?.busqueda)

  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id,
      numero,
      prefijo,
      fecha,
      numero_externo,
      total,
      estado,
      proveedor:proveedor_id(id, razon_social, numero_documento),
      recibos(valor)
    `)
    .eq('tipo', 'factura_compra')
    .neq('estado', 'cancelada')
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .limit(limit)

  if (error) throw error

  const mapped = (data ?? []).map((item) => {
    const recibos = Array.isArray(item.recibos) ? item.recibos as Array<{ valor?: number | null }> : []
    const pagado = roundMoney(recibos.reduce((sum, recibo) => sum + Number(recibo.valor ?? 0), 0))
    const total = Number(item.total ?? 0)
    const saldo = roundMoney(Math.max(0, total - pagado))
    const proveedor = (item.proveedor ?? null) as {
      id?: string
      razon_social?: string
      numero_documento?: string
    } | null

    return {
      id: String(item.id),
      numero: Number(item.numero ?? 0),
      prefijo: item.prefijo ?? '',
      fecha: String(item.fecha),
      numero_externo: item.numero_externo ?? null,
      total,
      pagado,
      saldo,
      estado: String(item.estado ?? 'pendiente'),
      proveedor: proveedor
        ? {
          id: proveedor.id ? String(proveedor.id) : '',
          razon_social: proveedor.razon_social ?? '',
          numero_documento: proveedor.numero_documento ?? '',
        }
        : null,
    }
  }).filter((item) => item.saldo > 0.009)

  if (!term) return mapped

  return mapped.filter((item) => {
    const haystack = [
      `${item.prefijo}${item.numero}`,
      item.numero_externo ?? '',
      item.proveedor?.razon_social ?? '',
      item.proveedor?.numero_documento ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(term.toLowerCase())
  })
}

export async function getCompraById(id: string): Promise<any> {
  const supabase = await createClient()
  const fetchCompra = async (selectClause: string): Promise<{ data: any; error: any }> => {
    const { data, error } = await supabase
      .from('documentos')
      .select(selectClause)
      .eq('id', id)
      .eq('tipo', 'factura_compra')
      .single()
    return { data, error }
  }

  const full = await fetchCompra(COMPRA_DETAIL_SELECT_FULL)
  if (!full.error) return full.data
  if (!isMissingColumnError(full.error)) throw full.error

  const legacy = await fetchCompra(COMPRA_DETAIL_SELECT_LEGACY)
  if (legacy.error) throw legacy.error
  if (!legacy.data) throw new Error('Compra no encontrada')

  const legacyData = legacy.data as unknown as Record<string, unknown> & {
    proveedor?: Record<string, unknown> | null
  }

  return {
    ...legacyData,
    documento_soporte_requerido: false,
    documento_soporte_estado: 'no_requerido',
    proveedor: legacyData.proveedor
      ? {
        ...legacyData.proveedor,
        obligado_a_facturar: null,
      }
      : legacyData.proveedor,
  }
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
  const { data, error } = await supabase.rpc('secure_crear_factura_compra', {
    p_ejercicio_id: params.ejercicio_id,
    p_proveedor_id: params.proveedor_id,
    p_bodega_id: params.bodega_id,
    p_fecha: params.fecha,
    p_numero_externo: params.numero_externo,
    p_observaciones: params.observaciones || null,
    p_lineas: params.lineas.map(l => ({
      ...l,
      variante_id: l.variante_id || null,
      impuesto_id: l.impuesto_id || null
    })),
  })
  if (error) throw error
  return data as string
}

export async function cancelarCompra(id: string) {
  const supabase = await createClient()
  await assertDocumentoCancelacionPermitida(id, 'factura_compra')
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
  retenciones?: Array<{
    retencion_id: string
    base_gravable?: number | null
    valor?: number | null
  }>
}) {
  const supabase = await createClient()
  const payload = {
    p_documento_id: params.documento_id,
    p_forma_pago_id: params.forma_pago_id,
    p_ejercicio_id: params.ejercicio_id,
    p_valor: params.valor,
    p_fecha: params.fecha,
    p_observaciones: params.observaciones || null,
    p_retenciones: (params.retenciones ?? []).map((item) => ({
      retencion_id: item.retencion_id,
      base_gravable: item.base_gravable ?? null,
      valor: item.valor ?? null,
    })),
  }

  const { data, error } = await supabase.rpc('secure_crear_pago_compra', payload)
  if (!error) return data as string

  if ((params.retenciones?.length ?? 0) > 0 && isMissingRpcSignature(error)) {
    throw new Error('La base de datos aún no tiene soporte operativo de retenciones para pagos. Aplica la migración contable pendiente.')
  }

  if (isMissingRpcSignature(error)) {
    const fallback = await supabase.rpc('secure_crear_pago_compra', {
      p_documento_id: params.documento_id,
      p_forma_pago_id: params.forma_pago_id,
      p_ejercicio_id: params.ejercicio_id,
      p_valor: params.valor,
      p_fecha: params.fecha,
      p_observaciones: params.observaciones || null,
    })
    if (fallback.error) throw fallback.error
    return fallback.data as string
  }

  throw error
}
