import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { maybeCreateServiceClient } from '@/lib/supabase/service'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
    const soloNoLeidas = searchParams.get('solo_no_leidas') === '1'

    const supabase = await createClient()
    let q = supabase
      .from('notificaciones')
      .select('id, tipo, titulo, mensaje, leida, datos, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (soloNoLeidas) q = q.eq('leida', false)

    const { data, error } = await q
    if (error) throw error

    const noLeidas = (data ?? []).filter(n => !n.leida).length
    return NextResponse.json({ items: data ?? [], alertas: data ?? [], no_leidas: noLeidas })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const todas = Boolean(body?.todas)
    const id = body?.id ? String(body.id) : null

    if (!todas && !id) {
      return NextResponse.json({ error: 'Se requiere id o todas=true' }, { status: 400 })
    }

    const admin = maybeCreateServiceClient()
    if (admin) {
      let q = admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('empresa_id', session.empresa_id)
        .or(`usuario_id.eq.${session.id},usuario_id.is.null`)
      if (!todas && id) q = q.eq('id', id)
      const { error } = await q
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const supabase = await createClient()
    let q = supabase.from('notificaciones').update({ leida: true })
    if (!todas && id) q = q.eq('id', id)
    const { error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
