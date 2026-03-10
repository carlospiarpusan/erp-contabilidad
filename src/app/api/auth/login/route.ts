import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimitStatus, registerLoginFailure, resetLoginFailures } from '@/lib/security/login-rate-limit'

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const key = `${getClientIp(req)}:${email}`
    const status = loginRateLimitStatus(key)
    if (status.blocked) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${status.retryAfterSeconds} segundos.` },
        { status: 429, headers: { 'Retry-After': String(status.retryAfterSeconds) } }
      )
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      registerLoginFailure(key)
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    const userId = data.user?.id
    if (!userId) {
      registerLoginFailure(key)
      return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 })
    }

    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('activo')
      .eq('id', userId)
      .single()

    if (usuarioError || !usuario?.activo) {
      await supabase.auth.signOut()
      registerLoginFailure(key)
      return NextResponse.json(
        { error: 'Tu usuario está inactivo o no tiene acceso al ERP' },
        { status: 403 }
      )
    }

    resetLoginFailures(key)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 })
  }
}
