import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cache } from 'react'

// Cliente con service_role para leer tablas de referencia bloqueadas por RLS
function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface UserSession {
  id: string
  email: string
  nombre: string
  rol: 'superadmin' | 'admin' | 'contador' | 'vendedor' | 'solo_lectura'
  empresa_id: string
  empresa_nombre?: string
}

export const getSession = cache(async (): Promise<UserSession | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('usuarios')
    .select('id, nombre, empresa_id, rol_id, empresas(nombre)')
    .eq('id', user.id)
    .single()

  if (!data) return null

  // Leer rol con service_role para evitar bloqueo de RLS en tabla roles
  const { data: rolData } = await adminClient()
    .from('roles')
    .select('nombre')
    .eq('id', data.rol_id)
    .single()

  const rol = (rolData?.nombre ?? 'solo_lectura') as UserSession['rol']
  const empresa_nombre = ((Array.isArray(data.empresas) ? data.empresas[0] : data.empresas) as { nombre: string } | null)?.nombre ?? undefined

  return {
    id: data.id,
    email: user.email ?? '',
    nombre: data.nombre,
    rol,
    empresa_id: data.empresa_id,
    empresa_nombre,
  }
})

export function puedeAcceder(rol: UserSession['rol'], modulo: keyof typeof PERMISOS_MODULO) {
  return (PERMISOS_MODULO[modulo] as readonly string[]).includes(rol)
}

export const PERMISOS_MODULO = {
  dashboard:    ['superadmin', 'admin', 'contador', 'vendedor', 'solo_lectura'],
  ventas:       ['superadmin', 'admin', 'contador', 'vendedor', 'solo_lectura'],
  clientes:     ['superadmin', 'admin', 'contador', 'vendedor', 'solo_lectura'],
  productos:    ['superadmin', 'admin', 'contador', 'vendedor', 'solo_lectura'],
  compras:      ['superadmin', 'admin', 'contador'],
  gastos:       ['superadmin', 'admin', 'contador'],
  contabilidad: ['superadmin', 'admin', 'contador'],
  informes:     ['superadmin', 'admin', 'contador', 'vendedor'],
  configuracion:['superadmin', 'admin'],
  superadmin:   ['superadmin'],
} as const satisfies Record<string, UserSession['rol'][]>
