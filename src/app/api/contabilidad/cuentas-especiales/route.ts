import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cuentas_especiales')
      .select('id, tipo, cuenta_id, cuentas_puc(codigo, descripcion)')
      .order('tipo')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { tipo, cuenta_id } = await req.json()
    if (!tipo || !cuenta_id) return NextResponse.json({ error: 'tipo y cuenta_id requeridos' }, { status: 400 })

    const empresa_id = await getEmpresaId()
    const supabase = await createClient()

    // Upsert: si existe el tipo, actualiza; si no, inserta
    const { error } = await supabase
      .from('cuentas_especiales')
      .upsert({ empresa_id, tipo, cuenta_id }, { onConflict: 'tipo' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
