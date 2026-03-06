import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .limit(1)
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    // Get empresa id first
    const { data: emp } = await supabase.from('empresas').select('id').limit(1).single()
    if (!emp?.id) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

    const allowed = ['nombre', 'nit', 'dv', 'razon_social', 'direccion', 'ciudad', 'departamento', 'pais', 'telefono', 'email', 'regimen', 'tipo_org']
    const updates: Record<string, unknown> = {}
    for (const k of allowed) {
      if (k in body) updates[k] = body[k] === '' ? null : body[k]
    }
    updates.updated_at = new Date().toISOString()

    const { error } = await supabase.from('empresas').update(updates).eq('id', emp.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
