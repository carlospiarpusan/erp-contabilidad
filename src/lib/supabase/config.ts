function cleanEnv(value?: string | null) {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || undefined
  }
  return trimmed
}

export function getSupabasePublicEnv() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const anonKey = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  if (!url || !anonKey) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return { url, anonKey }
}

export function getSupabaseServiceEnv() {
  const { url } = getSupabasePublicEnv()
  const serviceRoleKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!serviceRoleKey) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  }

  return { url, serviceRoleKey }
}

export function hasSupabaseServiceEnv() {
  return Boolean(
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)
  )
}
