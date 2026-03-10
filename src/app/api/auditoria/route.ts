import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.rol !== 'admin') {
      return NextResponse.json({ error: 'Sin permisos para auditoría' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 100)))
    const tabla = searchParams.get('tabla')
    const accion = searchParams.get('accion')

    const supabase = await createClient()
    let q = supabase
      .from('audit_log')
      .select('id, tabla, registro_id, accion, usuario_id, datos_antes, datos_nuevos, ip, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (tabla) q = q.eq('tabla', tabla)
    if (accion) q = q.eq('accion', accion)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
