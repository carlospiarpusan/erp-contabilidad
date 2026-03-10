import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hasSupabaseServiceEnv } from '@/lib/supabase/config'

export async function GET() {
  const startedAt = Date.now()

  const checks = {
    env: hasSupabaseServiceEnv(),
    db: false,
    latency_ms: 0,
  }

  try {
    const admin = createServiceClient()
    const { error } = await admin.from('roles').select('id').limit(1)
    if (error) throw error
    checks.db = true
    checks.latency_ms = Date.now() - startedAt
    return NextResponse.json({ ok: true, checks })
  } catch (e: unknown) {
    checks.latency_ms = Date.now() - startedAt
    return NextResponse.json(
      {
        ok: false,
        checks,
        error: e instanceof Error ? e.message : 'Healthcheck failed',
      },
      { status: 503 }
    )
  }
}
