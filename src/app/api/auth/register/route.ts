import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createEmpresaWithAdmin } from '@/lib/db/empresas'
import { loginRateLimitStatus, registerLoginFailure, resetLoginFailures } from '@/lib/security/login-rate-limit'

function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

const registerSchema = z.object({
  nombre_empresa: z.string().trim().min(2, 'Ingresa el nombre de la empresa').max(120),
  nit: z.string().trim().min(5, 'Ingresa un NIT válido').max(20),
  nombre_admin: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
  email_admin: z.string().trim().email('Ingresa un correo válido').max(160),
  password_admin: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(72),
})

function getErrorStatus(message: string) {
  const normalized = message.toLowerCase()
  if (
    normalized.includes('already been registered') ||
    normalized.includes('duplicate key') ||
    normalized.includes('already exists') ||
    normalized.includes('ya existe')
  ) {
    return 409
  }
  if (
    normalized.includes('inválido') ||
    normalized.includes('invalido') ||
    normalized.includes('requerid')
  ) {
    return 400
  }
  return 500
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Datos inválidos para el registro'
    return NextResponse.json({ error: firstError }, { status: 400 })
  }

  const { nombre_empresa, nit, nombre_admin, email_admin, password_admin } = parsed.data
  const key = `register:${getClientIp(req)}:${email_admin.toLowerCase()}`
  const status = loginRateLimitStatus(key)

  if (status.blocked) {
    return NextResponse.json(
      { error: `Demasiados intentos. Intenta de nuevo en ${status.retryAfterSeconds} segundos.` },
      { status: 429, headers: { 'Retry-After': String(status.retryAfterSeconds) } }
    )
  }

  try {
    const result = await createEmpresaWithAdmin({
      nombre: nombre_empresa,
      nit,
      razon_social: nombre_empresa,
      email: email_admin,
      email_admin,
      nombre_admin,
      password_admin,
      pais: 'Colombia',
    })

    resetLoginFailures(key)

    return NextResponse.json({
      ok: true,
      empresa_id: result.empresa_id,
      email: email_admin,
    }, { status: 201 })
  } catch (error) {
    registerLoginFailure(key)
    const message = error instanceof Error ? error.message : 'No fue posible completar el registro'
    return NextResponse.json({ error: message }, { status: getErrorStatus(message) })
  }
}
