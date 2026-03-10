import { maybeCreateServiceClient } from '@/lib/supabase/service'

interface RegistrarAuditoriaParams {
  empresa_id: string
  usuario_id?: string | null
  tabla: string
  registro_id?: string | null
  accion: 'INSERT' | 'UPDATE' | 'DELETE'
  datos_antes?: unknown
  datos_nuevos?: unknown
  ip?: string | null
}

export async function registrarAuditoria(params: RegistrarAuditoriaParams) {
  const admin = maybeCreateServiceClient()
  if (!admin) return
  await admin.from('audit_log').insert({
    empresa_id: params.empresa_id,
    usuario_id: params.usuario_id ?? null,
    tabla: params.tabla,
    registro_id: params.registro_id ?? null,
    accion: params.accion,
    datos_antes: params.datos_antes ?? null,
    datos_nuevos: params.datos_nuevos ?? null,
    ip: params.ip ?? null,
  })
}
