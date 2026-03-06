import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'

export async function GET() {
  try {
    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const { data, error } = await supabase.rpc('contar_sin_asiento', {
      p_empresa_id: empresa_id,
    })

    if (error) throw error
    return NextResponse.json({ pendientes: data ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])

    const { data, error } = await supabase.rpc('generar_asientos_masivo', {
      p_empresa_id: empresa_id,
    })

    if (error) throw error
    return NextResponse.json({ generados: data ?? [], total: (data ?? []).length })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
