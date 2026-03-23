import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

export interface HistorialImportacionItem {
  id: string
  tabla: string
  accion: string
  usuario_id?: string | null
  created_at: string
  datos_nuevos?: {
    entidad?: string
    total?: number
    exitosos?: number
    fallidos?: number
    detalle?: string
  } | null
}

export async function getHistorialImportaciones(limit = 12): Promise<HistorialImportacionItem[]> {
  const session = await getSession()
  if (!session || session.rol !== 'admin') {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('audit_log')
    .select('id, tabla, accion, usuario_id, created_at, datos_nuevos')
    .like('tabla', 'import_%')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return []
  }

  return (data ?? []) as HistorialImportacionItem[]
}
