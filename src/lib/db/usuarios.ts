import { createClient } from '@/lib/supabase/server'
import { getSupabaseServiceEnv } from '@/lib/supabase/config'
import { cleanUUIDs } from '@/lib/utils/db'
import { TENANT_ROLE_OPTIONS } from '@/lib/auth/permissions'

export interface UsuarioRow {
  id: string
  empresa_id: string
  rol_id: string | null
  nombre: string
  email: string
  telefono: string | null
  activo: boolean
  created_at: string
}

export async function getUsuarios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, empresa_id, rol_id, nombre, email, telefono, activo, created_at')
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
    .select('id, empresa_id, rol_id, nombre, email, telefono, activo, created_at')
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
    .select('id, empresa_id, rol_id, nombre, email, telefono, activo, created_at')
    .single()

  if (error) throw error
  return data as UsuarioRow
}

export async function invitarUsuario(email: string, nombre: string, rol_id: string) {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()
  // Crea usuario vía Supabase Admin Auth (service_role)
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
        password: `Temp${Date.now()}!`,
        email_confirm: false,
        user_metadata: { nombre },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.msg || err.message || 'Error al crear usuario')
  }

  // El trigger handle_new_user asigna rol 'vendedor' por defecto
  // Actualizamos al rol correcto
  const { id } = await res.json()
  const supabase = await createClient()
  await supabase.from('usuarios').update({ nombre, rol_id }).eq('id', id)
}

// Roles estáticos — UUIDs fijos en la DB, sin query para evitar bloqueos RLS
export async function getRoles() {
  return [...TENANT_ROLE_OPTIONS]
}
