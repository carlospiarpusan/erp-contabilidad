import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveRoleById, type AppRole } from '@/lib/auth/permissions'

type UsuarioContextRow = {
  id: string
  nombre: string
  empresa_id: string
  rol_id: string | null
  activo: boolean
  debe_cambiar_password: boolean
  empresas: { nombre: string } | { nombre: string }[] | null
}

export interface UsuarioContext {
  id: string
  nombre: string
  empresa_id: string
  rol: AppRole
  empresa_nombre?: string
  debe_cambiar_password: boolean
}

function getEmpresaNombre(empresas: UsuarioContextRow['empresas']) {
  const empresa = Array.isArray(empresas) ? empresas[0] : empresas
  return empresa?.nombre ?? undefined
}

export async function getUsuarioContext(
  supabase: Pick<SupabaseClient, 'from'>,
  userId: string
): Promise<UsuarioContext | null> {
  // Probar primero con todas las columnas
  let data: any, error: any;
  const initialResult = await supabase
    .from('usuarios')
    .select('id, nombre, empresa_id, rol_id, activo, debe_cambiar_password, empresas(nombre)')
    .eq('id', userId)
    .single()
  
  data = initialResult.data
  error = initialResult.error

  // Si falla porque no existe la columna (error 42703), reintentar sin debe_cambiar_password
  if (error && error.code === '42703') {
    const fallback = await supabase
      .from('usuarios')
      .select('id, nombre, empresa_id, rol_id, activo, empresas(nombre)')
      .eq('id', userId)
      .single()
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) return null

  const row = data as any
  if (!row.activo) return null

  const rol = resolveRoleById(row.rol_id)
  if (!rol) return null

  return {
    id: row.id,
    nombre: row.nombre,
    empresa_id: row.empresa_id,
    rol,
    empresa_nombre: getEmpresaNombre(row.empresas),
    debe_cambiar_password: row.debe_cambiar_password ?? false,
  }
}
