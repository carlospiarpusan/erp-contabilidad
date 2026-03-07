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
