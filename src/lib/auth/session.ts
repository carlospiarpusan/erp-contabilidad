import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// Mapa estático de rol_id → nombre (UUIDs fijos definidos en la DB)
const ROL_POR_ID: Record<string, UserSession['rol']> = {
  '10000000-0000-0000-0000-000000000001': 'admin',
  '10000000-0000-0000-0000-000000000002': 'vendedor',
  '10000000-0000-0000-0000-000000000003': 'contador',
  '10000000-0000-0000-0000-000000000004': 'solo_lectura',
  '10000000-0000-0000-0000-000000000005': 'superadmin',
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
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return null

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, empresa_id, rol_id, empresas(nombre)')
      .eq('id', user.id)
      .single()

    if (error || !data) return null

    // Resolver rol desde mapa estático — evita query a tabla roles (bloqueada por RLS)
    const rol = ROL_POR_ID[data.rol_id] ?? 'solo_lectura'
    const empresa_nombre = ((Array.isArray(data.empresas) ? data.empresas[0] : data.empresas) as { nombre: string } | null)?.nombre ?? undefined

    return {
      id: data.id,
      email: user.email ?? '',
      nombre: data.nombre,
      rol,
      empresa_id: data.empresa_id,
      empresa_nombre,
    }
  } catch {
    return null
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
