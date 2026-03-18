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

const FORMAS_PAGO_SELECT =
  'id, descripcion, tipo, dias_vencimiento, cuenta_id, activo:activa, cuenta:cuenta_id(codigo, descripcion)'

export async function getFormasPagoAll() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('formas_pago')
    .select(FORMAS_PAGO_SELECT)
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
    .insert({ ...payload, empresa_id, activa: true }).select(FORMAS_PAGO_SELECT).single()
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
  if (fields.activo !== undefined) payloadRaw.activa = fields.activo
  if (fields.genera_factura !== undefined) payloadRaw.genera_factura = fields.genera_factura

  const payload = cleanUUIDs(payloadRaw, ['cuenta_id'])

  const supabase = await createClient()
  const { data, error } = await supabase.from('formas_pago').update(payload).eq('id', id).select(FORMAS_PAGO_SELECT).single()
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

export async function createCuentaPUC(fields: {
  codigo: string
  descripcion: string
  tipo: string
  nivel: number
  naturaleza?: 'debito' | 'credito'
  cuenta_padre_id?: string | null
  activa?: boolean
}) {
  const payload = cleanUUIDs({
    codigo: fields.codigo.trim(),
    descripcion: fields.descripcion.trim(),
    tipo: fields.tipo.trim(),
    nivel: fields.nivel,
    naturaleza: fields.naturaleza ?? 'debito',
    cuenta_padre_id: fields.cuenta_padre_id ?? null,
    activa: fields.activa ?? true,
  }, ['cuenta_padre_id'])

  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const { data, error } = await supabase
    .from('cuentas_puc')
    .insert({ ...payload, empresa_id })
    .select('id, codigo, descripcion, tipo, nivel, naturaleza, cuenta_padre_id, activa')
    .single()
  if (error) throw error
  return data
}

export async function updateCuentaPUC(
  id: string,
  fields: Partial<{
    codigo: string
    descripcion: string
    tipo: string
    nivel: number
    naturaleza: 'debito' | 'credito'
    cuenta_padre_id: string | null
    activa: boolean
  }>
) {
  const payloadRaw: Record<string, unknown> = {}
  if (fields.codigo !== undefined) payloadRaw.codigo = fields.codigo.trim()
  if (fields.descripcion !== undefined) payloadRaw.descripcion = fields.descripcion.trim()
  if (fields.tipo !== undefined) payloadRaw.tipo = fields.tipo.trim()
  if (fields.nivel !== undefined) payloadRaw.nivel = fields.nivel
  if (fields.naturaleza !== undefined) payloadRaw.naturaleza = fields.naturaleza
  if (fields.cuenta_padre_id !== undefined) payloadRaw.cuenta_padre_id = fields.cuenta_padre_id
  if (fields.activa !== undefined) payloadRaw.activa = fields.activa

  const payload = cleanUUIDs(payloadRaw, ['cuenta_padre_id'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuentas_puc')
    .update(payload)
    .eq('id', id)
    .select('id, codigo, descripcion, tipo, nivel, naturaleza, cuenta_padre_id, activa')
    .single()
  if (error) throw error
  return data
}

// ── Asientos manuales ─────────────────────────────────────────────────────────

type AsientoLineaInput = {
  cuenta_id: string
  descripcion?: string
  debe: number
  haber: number
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function validarLineasPartidaDoble(lineas: AsientoLineaInput[]) {
  if (!Array.isArray(lineas) || lineas.length < 2) {
    throw new Error('El asiento debe tener al menos 2 líneas')
  }

  let totalDebe = 0
  let totalHaber = 0

  for (const linea of lineas) {
    if (!linea.cuenta_id) throw new Error('Todas las líneas deben tener cuenta')
    const debe = Number(linea.debe ?? 0)
    const haber = Number(linea.haber ?? 0)
    if (Number.isNaN(debe) || Number.isNaN(haber) || debe < 0 || haber < 0) {
      throw new Error('Valores de debe/haber inválidos')
    }
    if ((debe > 0 && haber > 0) || (debe === 0 && haber === 0)) {
      throw new Error('Cada línea debe tener solo débito o solo crédito')
    }
    totalDebe += debe
    totalHaber += haber
  }

  const debeRound = round2(totalDebe)
  const haberRound = round2(totalHaber)
  if (debeRound <= 0 || haberRound <= 0) {
    throw new Error('El asiento debe tener valores en débito y crédito')
  }
  if (debeRound !== haberRound) {
    throw new Error('El asiento está descuadrado: débito y crédito deben ser iguales')
  }

  return { total: debeRound }
}

async function siguienteNumeroAsiento(supabase: Awaited<ReturnType<typeof createClient>>, empresa_id: string) {
  const { data, error } = await supabase
    .from('asientos')
    .select('numero')
    .eq('empresa_id', empresa_id)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return Number(data?.numero ?? 0) + 1
}

async function ejercicioActivoId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('ejercicios')
    .select('id')
    .eq('estado', 'activo')
    .order('año', { ascending: false })
    .limit(1)
    .single()
  if (error || !data?.id) throw new Error('No hay ejercicio contable activo')
  return data.id as string
}

export async function createAsientoManual(fields: {
  fecha: string
  concepto: string
  lineas: AsientoLineaInput[]
}) {
  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const { total } = validarLineasPartidaDoble(fields.lineas)
  const [numero, ejercicio_id, auth] = await Promise.all([
    siguienteNumeroAsiento(supabase, empresa_id),
    ejercicioActivoId(supabase),
    supabase.auth.getUser(),
  ])

  const created_by = auth.data.user?.id ?? null
  const { data: asiento, error: asientoErr } = await supabase
    .from('asientos')
    .insert({
      empresa_id,
      ejercicio_id,
      numero,
      tipo: 'manual',
      tipo_doc: 'manual',
      concepto: fields.concepto.trim(),
      fecha: fields.fecha,
      importe: total,
      created_by,
    })
    .select('id, numero, tipo, tipo_doc, concepto, fecha, importe')
    .single()

  if (asientoErr || !asiento) throw asientoErr ?? new Error('No se pudo crear el asiento')

  const payloadLineas = fields.lineas.map((l) => ({
    asiento_id: asiento.id,
    cuenta_id: l.cuenta_id,
    descripcion: l.descripcion?.trim() || null,
    debe: Number(l.debe ?? 0),
    haber: Number(l.haber ?? 0),
  }))

  const { error: lineasErr } = await supabase
    .from('asientos_lineas')
    .insert(payloadLineas)

  if (lineasErr) {
    await supabase.from('asientos').delete().eq('id', asiento.id)
    throw lineasErr
  }

  return asiento
}

export async function updateAsientoManual(
  id: string,
  fields: Partial<{ fecha: string; concepto: string; lineas: AsientoLineaInput[] }>
) {
  const supabase = await createClient()
  const { data: actual, error: actualErr } = await supabase
    .from('asientos')
    .select('id, tipo, tipo_doc')
    .eq('id', id)
    .single()
  if (actualErr || !actual) throw actualErr ?? new Error('Asiento no encontrado')
  if (actual.tipo !== 'manual') throw new Error('Solo se pueden editar asientos manuales')

  const updatePayload: Record<string, unknown> = {}
  if (fields.fecha) updatePayload.fecha = fields.fecha
  if (fields.concepto !== undefined) updatePayload.concepto = fields.concepto.trim()

  if (fields.lineas) {
    const { total } = validarLineasPartidaDoble(fields.lineas)
    updatePayload.importe = total

    const { error: delErr } = await supabase.from('asientos_lineas').delete().eq('asiento_id', id)
    if (delErr) throw delErr

    const payloadLineas = fields.lineas.map((l) => ({
      asiento_id: id,
      cuenta_id: l.cuenta_id,
      descripcion: l.descripcion?.trim() || null,
      debe: Number(l.debe ?? 0),
      haber: Number(l.haber ?? 0),
    }))
    const { error: insErr } = await supabase.from('asientos_lineas').insert(payloadLineas)
    if (insErr) throw insErr
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase.from('asientos').update(updatePayload).eq('id', id)
    if (error) throw error
  }

  return { ok: true }
}

export async function revertirAsiento(
  asiento_id: string,
  opts?: { tipo_doc?: string; concepto?: string; allow_automatic?: boolean }
) {
  const { supabase, empresa_id } = await getCurrentEmpresaId()
  const tipo_doc = opts?.tipo_doc ?? 'reversion_manual'

  const { data: original, error: originalErr } = await supabase
    .from('asientos')
    .select(`
      id, empresa_id, ejercicio_id, numero, tipo, tipo_doc, concepto, fecha, importe,
      lineas:asientos_lineas(id, cuenta_id, descripcion, debe, haber)
    `)
    .eq('id', asiento_id)
    .single()

  if (originalErr || !original) throw originalErr ?? new Error('Asiento no encontrado')
  if (!opts?.allow_automatic && original.tipo !== 'manual') {
    throw new Error('Solo se pueden revertir asientos manuales desde este flujo')
  }

  const lineasOriginal = (original.lineas ?? []) as Array<{
    id: string
    cuenta_id: string
    descripcion?: string | null
    debe: number
    haber: number
  }>

  if (lineasOriginal.length === 0) {
    throw new Error('El asiento no tiene líneas para revertir')
  }

  const { data: yaExiste } = await supabase
    .from('asientos')
    .select('id')
    .eq('empresa_id', empresa_id)
    .eq('tipo_doc', tipo_doc)
    .ilike('concepto', `%${asiento_id}%`)
    .limit(1)
    .maybeSingle()

  if (yaExiste?.id) {
    throw new Error('Ya existe una reversión para este asiento')
  }

  const numero = await siguienteNumeroAsiento(supabase, empresa_id)
  const total = round2(lineasOriginal.reduce((s, l) => s + Number(l.haber ?? 0), 0))
  const concepto = opts?.concepto?.trim() || `Reversión asiento #${original.numero ?? 'N/A'} (${asiento_id})`

  const { data: reverso, error: reversoErr } = await supabase
    .from('asientos')
    .insert({
      empresa_id,
      ejercicio_id: original.ejercicio_id,
      numero,
      tipo: 'manual',
      tipo_doc,
      concepto,
      fecha: new Date().toISOString().split('T')[0],
      importe: total,
    })
    .select('id, numero')
    .single()

  if (reversoErr || !reverso) throw reversoErr ?? new Error('No se pudo crear el asiento de reversión')

  const payloadLineas = lineasOriginal.map((l) => ({
    asiento_id: reverso.id,
    cuenta_id: l.cuenta_id,
    descripcion: l.descripcion ?? `Reverso ${original.numero ?? ''}`.trim(),
    debe: Number(l.haber ?? 0),
    haber: Number(l.debe ?? 0),
  }))

  const { error: lineasErr } = await supabase.from('asientos_lineas').insert(payloadLineas)
  if (lineasErr) {
    await supabase.from('asientos').delete().eq('id', reverso.id)
    throw lineasErr
  }

  return reverso
}
