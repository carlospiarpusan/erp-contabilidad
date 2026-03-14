import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv } from '@/lib/supabase/config'
import { cleanUUIDs } from '@/lib/utils/db'
import { TENANT_ROLE_OPTIONS } from '@/lib/auth/permissions'

export interface UsuarioRow {
  id: string
  empresa_id: string
  rol_id: string | null
  nombre: string
  email: string
  cedula: string | null
  telefono: string | null
  activo: boolean
  debe_cambiar_password: boolean
  created_at: string
}

export async function getUsuarios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, empresa_id, rol_id, nombre, email, cedula, telefono, activo, debe_cambiar_password, created_at')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as UsuarioRow[]
}

export async function getUsuarioActual() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, empresa_id, rol_id, nombre, email, cedula, telefono, activo, debe_cambiar_password, created_at')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data as UsuarioRow
}

export async function updateUsuario(id: string, values: Partial<UsuarioRow>) {
  const { id: _, ...rest } = values
  const payload = cleanUUIDs(rest)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updatePerfilPropio(
  id: string,
  values: Partial<Pick<UsuarioRow, 'nombre' | 'telefono'>>
) {
  const payload = {
    ...(values.nombre !== undefined ? { nombre: values.nombre } : {}),
    ...(values.telefono !== undefined ? { telefono: values.telefono ?? null } : {}),
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .update(payload)
    .eq('id', id)
    .select('id, empresa_id, rol_id, nombre, email, cedula, telefono, activo, debe_cambiar_password, created_at')
    .single()

  if (error) throw error
  return data as UsuarioRow
}

export async function crearUsuario(
  email: string,
  nombre: string,
  rol_id: string,
  cedula: string
) {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  // La contraseña inicial es la cédula
  const res = await fetch(
    `${url}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: cedula,
        email_confirm: true,
        user_metadata: { nombre },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.msg || err.message || 'Error al crear usuario')
  }

  const { id } = await res.json()
  
  // Usar adminClient para saltar RLS al actualizar el perfil recién creado
  const adminClient = createAdminClient(url, serviceRoleKey)
  const { error: updateError } = await adminClient
    .from('usuarios')
    .update({ nombre, rol_id, cedula, debe_cambiar_password: true })
    .eq('id', id)

  if (updateError) throw updateError
}

/** Busca el email de un usuario por su cédula (para login con cédula).
 *  Usa service role porque durante el login no hay sesión y RLS bloquearía la query. */
export async function buscarEmailPorCedula(cedula: string): Promise<string | null> {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  const admin = createAdminClient(url, serviceRoleKey)

  const { data, error } = await admin
    .from('usuarios')
    .select('email')
    .eq('cedula', cedula)
    .eq('activo', true)
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data.email
}

/** Marca que el usuario ya cambió su contraseña.
 *  Usa service role para garantizar que el update funcione sin importar las políticas RLS. */
export async function marcarPasswordCambiado(userId: string) {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  const admin = createAdminClient(url, serviceRoleKey)
  const { error } = await admin
    .from('usuarios')
    .update({ debe_cambiar_password: false })
    .eq('id', userId)
  if (error) throw error
}

// Roles estáticos — UUIDs fijos en la DB, sin query para evitar bloqueos RLS
export async function getRoles() {
  return [...TENANT_ROLE_OPTIONS]
}
