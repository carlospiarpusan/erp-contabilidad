import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicEnv } from '@/lib/supabase/config'

export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv()
  return createBrowserClient(url, anonKey)
}
