import { createClient } from '@/lib/supabase/server'
import { cleanUUIDs } from '@/lib/utils/db'
import { getEmpresaId } from '@/lib/db/maestros'

// ── Acreedores ───────────────────────────────────────────────────────────────

export async function getAcreedores(params?: { busqueda?: string; activo?: boolean }) {
  const supabase = await createClient()
  let q = supabase.from('acreedores').select('*', { count: 'exact' }).order('razon_social')
  if (params?.activo !== undefined) q = q.eq('activo', params.activo)
  if (params?.busqueda) q = q.ilike('razon_social', `%${params.busqueda}%`)
  const { data, count, error } = await q
  if (error) throw error
  return { acreedores: data ?? [], total: count ?? 0 }
}

export async function createAcreedor(fields: {
  razon_social: string; contacto?: string; numero_documento?: string; email?: string; telefono?: string
}) {
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...fields, empresa_id, activo: true })

  const supabase = await createClient()
  const { data, error } = await supabase.from('acreedores')
    .insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateAcreedor(id: string, fields: Record<string, unknown>) {
  const { id: _, ...rest } = fields
  const payload = cleanUUIDs(rest)

  const supabase = await createClient()
  const { data, error } = await supabase.from('acreedores').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ── Tipos de Gasto ───────────────────────────────────────────────────────────

export async function getTiposGasto() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tipos_gasto')
    .select('id, descripcion, valor_estimado, cuenta:cuenta_id(codigo, descripcion)')
    .order('descripcion')
  if (error) throw error
  return data ?? []
}

export async function createTipoGasto(fields: { descripcion: string; cuenta_id?: string; valor_estimado?: number }) {
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...fields, empresa_id })

  const supabase = await createClient()
  const { data, error } = await supabase.from('tipos_gasto')
    .insert(payload).select().single()
  if (error) throw error
  return data
}

export async function updateTipoGasto(id: string, fields: Record<string, unknown>) {
  const { id: _, ...rest } = fields
  const payload = cleanUUIDs(rest)

  const supabase = await createClient()
  const { data, error } = await supabase.from('tipos_gasto').update(payload).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTipoGasto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('tipos_gasto').delete().eq('id', id)
  if (error) throw error
}

// ── Gastos ───────────────────────────────────────────────────────────────────

export async function getEstadisticasGastos() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos').select('total, fecha').eq('tipo', 'gasto')
  if (error) throw error
  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const primerMes = new Date(hoy.getFullYear(), 0, 1).toISOString().split('T')[0]
  return {
    total: data.length,
    total_monto: data.reduce((s, r) => s + (r.total ?? 0), 0),
    este_mes: data.filter(r => r.fecha >= primerDia).reduce((s, r) => s + (r.total ?? 0), 0),
    este_anio: data.filter(r => r.fecha >= primerMes).reduce((s, r) => s + (r.total ?? 0), 0),
  }
}

export async function getGastos(params?: {
  busqueda?: string; desde?: string; hasta?: string; limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, desde, hasta, limit = 100, offset = 0 } = params ?? {}
  let q = supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, subtotal, total, observaciones,
      acreedor:acreedor_id(razon_social),
      forma_pago:forma_pago_id(descripcion),
      lineas:documentos_lineas(descripcion, total)
    `, { count: 'exact' })
    .eq('tipo', 'gasto')
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1)
  if (desde) q = q.gte('fecha', desde)
  if (hasta) q = q.lte('fecha', hasta)
  if (busqueda) q = q.ilike('observaciones', `%${busqueda}%`)
  const { data, count, error } = await q
  if (error) throw error
  return { gastos: data ?? [], total: count ?? 0 }
}

export async function getGastoById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, total, observaciones,
      acreedor:acreedor_id(razon_social, email, telefono),
      forma_pago:forma_pago_id(descripcion),
      lineas:documentos_lineas(id, descripcion, precio_unitario, total)
    `)
    .eq('id', id).eq('tipo', 'gasto').single()
  if (error) throw error
  return data
}

export async function createGasto(params: {
  empresa_id: string
  ejercicio_id: string
  acreedor_id?: string
  tipo_gasto_id: string
  forma_pago_id: string
  fecha: string
  descripcion: string
  valor: number
  observaciones?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('crear_gasto', {
    p_empresa_id: params.empresa_id,
    p_ejercicio_id: params.ejercicio_id,
    p_acreedor_id: params.acreedor_id || null,
    p_tipo_gasto_id: params.tipo_gasto_id,
    p_forma_pago_id: params.forma_pago_id,
    p_fecha: params.fecha,
    p_descripcion: params.descripcion,
    p_valor: params.valor,
    p_observaciones: params.observaciones || null,
  })
  if (error) throw error
  return data as string
}

export async function cancelarGasto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('documentos')
    .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
    .eq('id', id).eq('tipo', 'gasto')
  if (error) throw error
}
