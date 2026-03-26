export class HttpError extends Error {
  status: number
  code?: string

  constructor(message: string, status = 400, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/** Extrae un mensaje de error legible de cualquier tipo de excepción (Error, objeto Supabase, string, etc.) */
export function toErrorMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.details === 'string') return obj.details
    if (typeof obj.error === 'string') return obj.error
  }
  return 'Error inesperado'
}

export function getErrorStatus(e: unknown, fallback = 500): number {
  if (e instanceof HttpError) return e.status
  if (e && typeof e === 'object') {
    const status = (e as { status?: unknown }).status
    if (typeof status === 'number' && Number.isFinite(status)) return status
    const code = String((e as { code?: unknown }).code ?? '')
    if (code === '23505') return 409
    if (code === 'PGRST116') return 404
  }
  return fallback
}
