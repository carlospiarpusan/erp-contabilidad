import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { marcarPasswordCambiado } from '@/lib/db/usuarios'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const password = String(body?.password ?? '')
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener mínimo 8 caracteres' }, { status: 400 })
    }

    // Actualizar contraseña en Supabase Auth
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Marcar que ya no necesita cambiar contraseña
    await marcarPasswordCambiado(user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al cambiar contraseña' }, { status: 500 })
  }
}
