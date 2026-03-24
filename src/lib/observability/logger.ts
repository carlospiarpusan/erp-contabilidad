import { maybeCreateServiceClient } from '@/lib/supabase/service'
import type { UserSession } from '@/lib/auth/session'

export type LogLevel = 'info' | 'warn' | 'error'

type LogEventParams = {
  level?: LogLevel
  source: string
  event: string
  session?: Pick<UserSession, 'empresa_id' | 'id'> | null
  method?: string | null
  route?: string | null
  context?: Record<string, unknown> | null
}

function serializeErrorContext(context: Record<string, unknown> | null | undefined) {
  try {
    return JSON.parse(JSON.stringify(context ?? {})) as Record<string, unknown>
  } catch {
    return { serialization_error: true }
  }
}

export async function logServerEvent(params: LogEventParams) {
  const payload = {
    level: params.level ?? 'info',
    source: params.source,
    event: params.event,
    empresa_id: params.session?.empresa_id ?? null,
    usuario_id: params.session?.id ?? null,
    method: params.method ?? null,
    route: params.route ?? null,
    context: serializeErrorContext(params.context),
  }

  const logger = payload.level === 'error' ? console.error : payload.level === 'warn' ? console.warn : console.info
  logger('[clovent]', payload)

  const admin = maybeCreateServiceClient()
  if (!admin) return

  try {
    await admin.from('app_event_logs').insert({
      empresa_id: payload.empresa_id,
      usuario_id: payload.usuario_id,
      nivel: payload.level,
      origen: payload.source,
      evento: payload.event,
      metodo: payload.method,
      ruta: payload.route,
      contexto: payload.context,
    })
  } catch {
    // logging must never break the request flow
  }
}
