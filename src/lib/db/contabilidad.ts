import { createClient } from '@/lib/supabase/server'

// ── Asientos ─────────────────────────────────────────────────────────────────

export async function getAsientos(params?: {
  tipo_doc?: string; desde?: string; hasta?: string; limit?: number; offset?: number
}) {
  const supabase = await createClient()
  const { tipo_doc, desde, hasta, limit = 100, offset = 0 } = params ?? {}
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
    .range(offset, offset + limit - 1)
  if (tipo_doc) q = q.eq('tipo_doc', tipo_doc)
  if (desde)    q = q.gte('fecha', desde)
  if (hasta)    q = q.lte('fecha', hasta)
  const { data, count, error } = await q
  if (error) throw error
  return { asientos: data ?? [], total: count ?? 0 }
}

// ── Cuentas PUC ──────────────────────────────────────────────────────────────

export async function getCuentasPUC(params?: { busqueda?: string; nivel?: number }) {
  const supabase = await createClient()
  let q = supabase
    .from('cuentas_puc')
    .select('id, codigo, descripcion, tipo, nivel, activo', { count: 'exact' })
    .order('codigo')
  if (params?.nivel)    q = q.eq('nivel', params.nivel)
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: uRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single()
  const { data, error } = await supabase.from('ejercicios')
    .insert({ ...fields, empresa_id: uRow!.empresa_id, estado: 'activo' }).select().single()
  if (error) throw error
  return data
}

export async function updateEjercicio(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('ejercicios').update(fields).eq('id', id).select().single()
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

export async function createImpuesto(fields: { nombre: string; porcentaje: number; tipo?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: uRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single()
  const { data, error } = await supabase.from('impuestos')
    .insert({ ...fields, empresa_id: uRow!.empresa_id }).select().single()
  if (error) throw error
  return data
}

export async function updateImpuesto(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('impuestos').update(fields).eq('id', id).select().single()
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: uRow } = await supabase.from('usuarios').select('empresa_id').eq('id', user!.id).single()
  const { data, error } = await supabase.from('formas_pago')
    .insert({ ...fields, empresa_id: uRow!.empresa_id, activo: true }).select().single()
  if (error) throw error
  return data
}

export async function updateFormaPago(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('formas_pago').update(fields).eq('id', id).select().single()
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

export async function updateConsecutivo(id: string, fields: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('consecutivos').update(fields).eq('id', id).select().single()
  if (error) throw error
  return data
}
