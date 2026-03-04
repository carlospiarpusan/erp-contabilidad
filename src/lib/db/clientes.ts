import { createClient } from '@/lib/supabase/server'
import type { Cliente } from '@/types'

export async function getClientes(params?: {
  busqueda?: string
  activo?: boolean
  grupo_id?: string
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, activo = true, grupo_id, limit = 50, offset = 0 } = params ?? {}

  let query = supabase
    .from('clientes')
    .select(`
      *,
      grupo:grupos_clientes(id, nombre),
      colaborador:colaboradores(id, nombre)
    `, { count: 'exact' })
    .order('razon_social')
    .range(offset, offset + limit - 1)

  if (activo !== undefined) query = query.eq('activo', activo)
  if (grupo_id) query = query.eq('grupo_id', grupo_id)
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

export async function createCliente(datos: Partial<Cliente>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

export async function updateCliente(id: string, datos: Partial<Cliente>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Cliente
}

export async function deleteCliente(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('clientes')
    .update({ activo: false })
    .eq('id', id)

  if (error) throw error
}

export async function getGruposClientes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('grupos_clientes')
    .select('*')
    .order('nombre')

  if (error) throw error
  return data ?? []
}

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
