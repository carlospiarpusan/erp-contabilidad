import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import { canAccessModule, MODULE_ACCESS, type AppModule, type AppRole, type AccessScope } from '@/lib/auth/permissions'
import { getUsuarioContext } from '@/lib/auth/user-context'

export interface UserSession {
  id: string
  email: string
  nombre: string
  rol: AppRole
  empresa_id: string
  empresa_nombre?: string
  debe_cambiar_password: boolean
  tiene_multi_empresa: boolean
}

export const getSession = cache(async (): Promise<UserSession | null> => {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return null

    const context = await getUsuarioContext(supabase, user.id)
    if (!context) return null

    return {
      id: context.id,
      email: user.email ?? '',
      nombre: context.nombre,
      rol: context.rol,
      empresa_id: context.empresa_id,
      empresa_nombre: context.empresa_nombre,
      debe_cambiar_password: context.debe_cambiar_password,
      tiene_multi_empresa: context.tiene_multi_empresa,
    }
  } catch {
    return null
  }
})

export function puedeAcceder(
  rol: UserSession['rol'],
  modulo: AppModule,
  scope: AccessScope = 'read'
) {
  return canAccessModule(rol, modulo, scope)
}

export const PERMISOS_MODULO = MODULE_ACCESS
