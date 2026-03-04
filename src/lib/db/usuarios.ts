import { createClient } from '@/lib/supabase/server'

export interface UsuarioRow {
  id: string
  empresa_id: string
  rol_id: string | null
  nombre: string
  email: string
  telefono: string | null
  activo: boolean
  created_at: string
  roles?: { nombre: string } | null
}

export async function getUsuarios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*, roles(nombre)')
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
    .select('*, roles(nombre)')
    .eq('id', user.id)
    .single()

  if (error) return null
  return data as UsuarioRow
}

export async function updateUsuario(id: string, values: Partial<UsuarioRow>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios')
    .update(values)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function invitarUsuario(email: string, nombre: string, rol_id: string) {
  // Crea usuario vía Supabase Admin Auth (service_role)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

export async function getRoles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .select('id, nombre, descripcion')
    .order('nombre')

  if (error) throw error
  return data
}
