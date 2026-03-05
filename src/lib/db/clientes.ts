import { createClient } from '@/lib/supabase/server'
import type { Cliente, GrupoCliente } from '@/types'
import { cleanUUIDs } from '@/lib/utils/db'
import { getEmpresaId } from '@/lib/db/maestros'

export async function getClientes(params?: {
  busqueda?: string
  activo?: boolean
  grupo_id?: string
  tipo_documento?: string
  ciudad?: string
  limite_credito?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const {
    busqueda, activo = true, grupo_id, tipo_documento,
    ciudad, limite_credito, limit = 50, offset = 0
  } = params ?? {}

  let query = supabase
    .from('clientes')
    .select('*, grupo:grupos_clientes(id, nombre), colaborador:colaboradores(id, nombre)', { count: 'exact' })
    .order('razon_social')
    .range(offset, offset + limit - 1)

  if (activo !== undefined) query = query.eq('activo', activo)
  if (grupo_id) query = query.eq('grupo_id', grupo_id)
  if (tipo_documento) query = query.eq('tipo_documento', tipo_documento)
  if (ciudad) query = query.ilike('ciudad', `%${ciudad}%`)
  if (limite_credito) query = query.gt('limite_credito', 0)
  if (busqueda) {
    query = query.or(
      `razon_social.ilike.%${busqueda}%,numero_documento.ilike.%${busqueda}%,email.ilike.%${busqueda}%,telefono.ilike.%${busqueda}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error
  return { clientes: (data ?? []) as Cliente[], total: count ?? 0 }
}

export async function getClienteById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .select(`
      *,
      grupo:grupos_clientes(id, nombre, descuento_porcentaje),
      colaborador:colaboradores(id, nombre),
      direcciones:clientes_direcciones(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Cliente
}

export async function getEstadisticasClientes() {
  const supabase = await createClient()

  const [totalRes, activosRes, conCreditoRes, gruposRes] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('clientes').select('*', { count: 'exact', head: true }).gt('limite_credito', 0),
    supabase.from('grupos_clientes').select('id, nombre, clientes(count)'),
  ])

  const total = totalRes.count ?? 0
  const activos = activosRes.count ?? 0

  return {
    total,
    activos,
    conCredito: conCreditoRes.count ?? 0,
    inactivos: total - activos,
    grupos: (gruposRes.data ?? []) as { id: string; nombre: string; clientes: { count: number }[] }[],
  }
}

export async function createCliente(datos: Partial<Cliente>) {
  const empresa_id = await getEmpresaId()

  // Ultra-Agresivo: quitar 'id' si existe, trim de strings, vacios a null
  const cleanData = { ...datos }
  delete (cleanData as any).id

  const entries = Object.entries({ ...cleanData, empresa_id }).map(([key, val]) => {
    let finalVal = val
    if (typeof val === 'string') {
      finalVal = val.trim()
      if (finalVal === '') finalVal = null as any
    }
    return [key, finalVal]
  })
  const payload = Object.fromEntries(entries) as any

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert(payload)
    .select()
    .single()

  if (error) {
    console.error('Insert error details:', error)
    throw new Error(`Error BD (${error.code}): ${error.message}`)
  }
  return data as Cliente
}

export async function updateCliente(id: string, datos: Partial<Cliente>) {
  // Remove id from payload, and clean all empty strings
  const { id: _, empresa_id: __, ...rest } = datos
  const entries = Object.entries(rest).map(([key, val]) => [
    key,
    val === '' ? null as any : val
  ])
  const payload = Object.fromEntries(entries) as any

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

export async function deleteCliente(id: string) {
  const supabase = await createClient()

  // Intentamos borrado físico primero
  const { error: deleteError } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id)

  if (deleteError) {
    // Si el error es por integridad referencial (código 23503), hacemos borrado lógico
    if (deleteError.code === '23503') {
      const { error: updateError } = await supabase
        .from('clientes')
        .update({ activo: false })
        .eq('id', id)

      if (updateError) throw updateError
      return
    }
    throw deleteError
  }
}

// ── Grupos ────────────────────────────────────────────────────

export async function getGruposClientes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_clientes')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data ?? []
}

export async function getGruposConConteo() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_clientes')
    .select('*, clientes(count)')
    .order('nombre')

  if (error) throw error
  return (data ?? []) as (GrupoCliente & { clientes: { count: number }[] })[]
}

export async function createGrupo(datos: Partial<GrupoCliente>) {
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...datos, empresa_id })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_clientes')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as GrupoCliente
}

export async function updateGrupo(id: string, datos: Partial<GrupoCliente>) {
  const { id: _, ...rest } = datos
  const payload = cleanUUIDs(rest)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_clientes')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as GrupoCliente
}

export async function deleteGrupo(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('grupos_clientes')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── Stats por cliente ─────────────────────────────────────────

export async function getResumenCliente(cliente_id: string) {
  const supabase = await createClient()

  const [facturasRes, recibosRes, ultimasRes] = await Promise.all([
    supabase
      .from('documentos')
      .select('id, total, estado', { count: 'exact' })
      .eq('tipo', 'factura_venta')
      .eq('cliente_id', cliente_id),
    supabase
      .from('recibos')
      .select('valor')
      .eq('tipo', 'venta')
      .eq('cliente_id', cliente_id),
    supabase
      .from('documentos')
      .select('id, numero, prefijo, total, fecha, estado')
      .eq('tipo', 'factura_venta')
      .eq('cliente_id', cliente_id)
      .order('fecha', { ascending: false })
      .limit(5),
  ])

  const facturas = facturasRes.data ?? []
  const total_facturas = facturasRes.count ?? 0
  const total_compras = facturas.reduce((s: number, f: any) => s + (f.total ?? 0), 0)
  const total_cobrado = (recibosRes.data ?? []).reduce((s: number, r: any) => s + (r.valor ?? 0), 0)
  const saldo_pendiente = total_compras - total_cobrado

  return {
    total_facturas,
    total_compras,
    total_cobrado,
    saldo_pendiente: Math.max(0, saldo_pendiente),
    ultimas_facturas: ultimasRes.data ?? [],
  }
}

// ── Deudores ──────────────────────────────────────────────────

export async function getClienteDeudores(limit = 10) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      cliente_id,
      cliente:clientes(id, razon_social, telefono, email),
      total,
      fecha_vencimiento
    `)
    .eq('tipo', 'factura_venta')
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', new Date().toISOString().split('T')[0])
    .order('fecha_vencimiento')
    .limit(limit)

  if (error) throw error
  return data ?? []
}
