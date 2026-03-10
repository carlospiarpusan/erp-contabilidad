import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

type Pendiente = { tipo: string; pendientes: number }

function totalPendientes(items: Pendiente[]) {
  return items.reduce((sum, item) => sum + Number(item.pendientes ?? 0), 0)
}

async function obtenerPendientes(supabase: Awaited<ReturnType<typeof createClient>>, empresa_id: string) {
  const { data, error } = await supabase.rpc('contar_sin_asiento', {
    p_empresa_id: empresa_id,
  })

  if (error) throw error
  return (data ?? []) as Pendiente[]
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
    const pendientes = await obtenerPendientes(supabase, empresa_id)
    return NextResponse.json({ pendientes })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const [supabase, empresa_id] = await Promise.all([createClient(), getEmpresaId()])
    const pendientesAntes = await obtenerPendientes(supabase, empresa_id)

    const { data, error } = await supabase.rpc('generar_asientos_masivo', {
      p_empresa_id: empresa_id,
    })

    if (error) throw error
    const generados = data ?? []
    const pendientesRestantes = await obtenerPendientes(supabase, empresa_id)
    const totalAntes = totalPendientes(pendientesAntes)
    const totalRestantes = totalPendientes(pendientesRestantes)

    if (totalAntes > 0 && generados.length === 0 && totalRestantes === totalAntes) {
      return NextResponse.json({
        error: 'No se generó ningún asiento. Verifica que los documentos tengan ejercicio contable y que las cuentas especiales estén configuradas.',
      }, { status: 500 })
    }

    const warning = totalRestantes > 0
      ? `Se generaron ${generados.length} asientos, pero aún quedan ${totalRestantes} pendientes.`
      : null

    return NextResponse.json({
      generados,
      total: generados.length,
      pendientes_antes: pendientesAntes,
      pendientes_restantes: pendientesRestantes,
      total_antes: totalAntes,
      total_restantes: totalRestantes,
      warning,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
