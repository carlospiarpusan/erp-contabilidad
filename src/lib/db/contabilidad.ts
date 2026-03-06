import { createClient } from '@/lib/supabase/server'
import { cleanUUIDs } from '@/lib/utils/db'

async function getCurrentEmpresaId() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('No autenticado')

  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  if (usuarioError || !usuario?.empresa_id) {
    throw new Error('Usuario sin empresa asignada')
  }

  return { supabase, empresa_id: usuario.empresa_id as string }
}

// ── Asientos ─────────────────────────────────────────────────────────────────

export async function getAsientos(params?: {
  tipo_doc?: string; desde?: string; hasta?: string; limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { tipo_doc, desde, hasta, limit = 100, offset = 0 } = params ?? {}
  const safeLimit = Math.max(1, Math.min(limit, 500))
  const safeOffset = Math.max(0, offset)
  let q = supabase
    .from('asientos')
    .select(`
      id, numero, tipo, tipo_doc, concepto, fecha, importe,
      lineas:asientos_lineas(id, descripcion, debe, haber,
        cuenta:cuenta_id(codigo, descripcion)
      )
    `, { count: 'exact' })
    .order('fecha', { ascending: false })
    .order('numero', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)
  if (tipo_doc) q = q.eq('tipo_doc', tipo_doc)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  const { data, count, error } = await q
  if (error) throw error
  return { asientos: data ?? [], total: count ?? 0 }
}

// ── Cuentas PUC ──────────────────────────────────────────────────────────────

export async function getCuentasPUC(params?: { busqueda?: string; nivel?: number }) {
  const supabase = await createClient()
  let q = supabase
    .from('cuentas_puc')
    .select('id, codigo, descripcion, tipo, nivel, naturaleza, activa', { count: 'exact' })
    .order('codigo')
  if (params?.nivel) q = q.eq('nivel', params.nivel)
  if (params?.busqueda) {
    q = q.or(`codigo.ilike.%${params.busqueda}%,descripcion.ilike.%${params.busqueda}%`)
  }
  const { data, count, error } = await q
  if (error) throw error
  return { cuentas: data ?? [], total: count ?? 0 }
}

// ── Ejercicios ────────────────────────────────────────────────────────────────

export async function getEjerciciosAll() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ejercicios').select('*').order('año', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createEjercicio(fields: { año: number; descripcion?: string; fecha_inicio: string; fecha_fin: string }) {
  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const { data, error } = await supabase.from('ejercicios')
    .insert({ ...fields, empresa_id, estado: 'activo' }).select().single()
  if (error) throw error
  return data
}

export async function updateEjercicio(
  id: string,
  fields: Partial<{ año: number; descripcion: string; fecha_inicio: string; fecha_fin: string; estado: string }>
) {
  const payload: Record<string, unknown> = {}
  if (fields.año !== undefined) payload.año = fields.año
  if (fields.descripcion !== undefined) payload.descripcion = fields.descripcion
  if (fields.fecha_inicio !== undefined) payload.fecha_inicio = fields.fecha_inicio
  if (fields.fecha_fin !== undefined) payload.fecha_fin = fields.fecha_fin
  if (fields.estado !== undefined) payload.estado = fields.estado

  const supabase = await createClient()
  const { data, error } = await supabase.from('ejercicios').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Impuestos ─────────────────────────────────────────────────────────────────

export async function getImpuestosAll() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('impuestos').select('*', { count: 'exact' }).order('porcentaje')
  if (error) throw error
  return data ?? []
}

export async function createImpuesto(fields: {
  codigo: string
  descripcion?: string
  nombre?: string
  porcentaje: number
  porcentaje_recargo?: number
  subcuenta_compras_id?: string | null
  subcuenta_ventas_id?: string | null
  por_defecto?: boolean
}) {
  const descripcion = fields.descripcion ?? fields.nombre ?? ''
  if (!fields.codigo || !descripcion) {
    throw new Error('codigo y descripcion son requeridos')
  }

  const payload = cleanUUIDs({
    codigo: fields.codigo,
    descripcion,
    porcentaje: fields.porcentaje,
    porcentaje_recargo: fields.porcentaje_recargo ?? 0,
    subcuenta_compras_id: fields.subcuenta_compras_id,
    subcuenta_ventas_id: fields.subcuenta_ventas_id,
    por_defecto: fields.por_defecto ?? false,
  }, ['subcuenta_compras_id', 'subcuenta_ventas_id'])

  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const { data, error } = await supabase.from('impuestos')
    .insert({ ...payload, empresa_id }).select().single()
  if (error) throw error
  return data
}

export async function updateImpuesto(
  id: string,
  fields: Partial<{
    codigo: string
    descripcion: string
    nombre: string
    porcentaje: number
    porcentaje_recargo: number
    subcuenta_compras_id: string | null
    subcuenta_ventas_id: string | null
    por_defecto: boolean
  }>
) {
  const payloadRaw: Record<string, unknown> = {}
  if (fields.codigo !== undefined) payloadRaw.codigo = fields.codigo
  if (fields.descripcion !== undefined) payloadRaw.descripcion = fields.descripcion
  if (fields.nombre !== undefined && fields.descripcion === undefined) payloadRaw.descripcion = fields.nombre
  if (fields.porcentaje !== undefined) payloadRaw.porcentaje = fields.porcentaje
  if (fields.porcentaje_recargo !== undefined) payloadRaw.porcentaje_recargo = fields.porcentaje_recargo
  if (fields.subcuenta_compras_id !== undefined) payloadRaw.subcuenta_compras_id = fields.subcuenta_compras_id
  if (fields.subcuenta_ventas_id !== undefined) payloadRaw.subcuenta_ventas_id = fields.subcuenta_ventas_id
  if (fields.por_defecto !== undefined) payloadRaw.por_defecto = fields.por_defecto

  const payload = cleanUUIDs(payloadRaw, ['subcuenta_compras_id', 'subcuenta_ventas_id'])

  const supabase = await createClient()
  const { data, error } = await supabase.from('impuestos').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteImpuesto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('impuestos').delete().eq('id', id)
  if (error) throw error
}

// ── Formas de Pago ─────────────────────────────────────────────────────────────

export async function getFormasPagoAll() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formas_pago')
    .select('id, descripcion, tipo, dias_vencimiento, activo, cuenta:cuenta_id(codigo, descripcion)')
    .order('descripcion')
  if (error) throw error
  return data ?? []
}

export async function createFormaPago(fields: {
  descripcion: string; tipo: string; dias_vencimiento?: number; cuenta_id?: string
}) {
  const payload = cleanUUIDs({ ...fields }, ['cuenta_id'])

  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const { data, error } = await supabase.from('formas_pago')
    .insert({ ...payload, empresa_id, activo: true }).select().single()
  if (error) throw error
  return data
}

export async function updateFormaPago(
  id: string,
  fields: Partial<{
    descripcion: string
    tipo: string
    dias_vencimiento: number
    cuenta_id: string | null
    activo: boolean
    genera_factura: boolean
  }>
) {
  const payloadRaw: Record<string, unknown> = {}
  if (fields.descripcion !== undefined) payloadRaw.descripcion = fields.descripcion
  if (fields.tipo !== undefined) payloadRaw.tipo = fields.tipo
  if (fields.dias_vencimiento !== undefined) payloadRaw.dias_vencimiento = fields.dias_vencimiento
  if (fields.cuenta_id !== undefined) payloadRaw.cuenta_id = fields.cuenta_id
  if (fields.activo !== undefined) payloadRaw.activo = fields.activo
  if (fields.genera_factura !== undefined) payloadRaw.genera_factura = fields.genera_factura

  const payload = cleanUUIDs(payloadRaw, ['cuenta_id'])

  const supabase = await createClient()
  const { data, error } = await supabase.from('formas_pago').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteFormaPago(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('formas_pago').delete().eq('id', id)
  if (error) throw error
}

// ── Consecutivos ───────────────────────────────────────────────────────────────

export async function getConsecutivos() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consecutivos').select('*').order('tipo')
  if (error) throw error
  return data ?? []
}

export async function updateConsecutivo(
  id: string,
  fields: Partial<{ prefijo: string; consecutivo_actual: number; activo: boolean; descripcion: string }>
) {
  const payload: Record<string, unknown> = {}
  if (fields.prefijo !== undefined) payload.prefijo = fields.prefijo
  if (fields.consecutivo_actual !== undefined) payload.consecutivo_actual = fields.consecutivo_actual
  if (fields.activo !== undefined) payload.activo = fields.activo
  if (fields.descripcion !== undefined) payload.descripcion = fields.descripcion

  const supabase = await createClient()
  const { data, error } = await supabase.from('consecutivos').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}
