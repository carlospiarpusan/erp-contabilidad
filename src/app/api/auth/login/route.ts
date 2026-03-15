import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { loginRateLimitStatus, registerLoginFailure, resetLoginFailures } from '@/lib/security/login-rate-limit'
import { buscarEmailPorCedula } from '@/lib/db/usuarios'

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Detecta si el input parece una cédula (solo números) o un email */
function looksLikeCedula(input: string) {
  return /^\d{5,20}$/.test(input)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const identifier = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')
    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/cédula y contraseña son requeridos' }, { status: 400 })
    }

    // Si el identificador parece cédula, buscar el email asociado
    let email = identifier
    if (looksLikeCedula(identifier)) {
      const found = await buscarEmailPorCedula(identifier)
      if (!found) {
        return NextResponse.json({ error: 'No se encontró un usuario con esa cédula' }, { status: 401 })
      }
      email = found
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

    // Usar service role para verificar estado sin depender de RLS durante el login
    const adminClient = createServiceClient()
    const { data: usuario, error: usuarioError } = await adminClient
      .from('usuarios')
      .select('activo, debe_cambiar_password')
      .eq('id', userId)
      .single()

    if (usuarioError || !usuario?.activo) {
      console.error('Login block:', { userId, usuarioError, activo: usuario?.activo })
      await supabase.auth.signOut()
      registerLoginFailure(key)
      return NextResponse.json(
        { error: 'Tu usuario está inactivo o no tiene acceso al ERP' },
        { status: 403 }
      )
    }

    resetLoginFailures(key)
    return NextResponse.json({
      ok: true,
      debe_cambiar_password: usuario.debe_cambiar_password ?? false,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 })
  }
}
