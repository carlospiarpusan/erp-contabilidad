import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseServiceEnv } from '@/lib/supabase/config'

export function createServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseServiceEnv()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function maybeCreateServiceClient(): SupabaseClient | null {
  try {
    return createServiceClient()
  } catch {
    return null
  }
}
