import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { ensurePeriodoAbierto } from '@/lib/db/compliance'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'
import { getTodayInAppTimeZone } from '@/lib/utils/dates'

const ROLES_TRASLADO = new Set(['admin', 'contador'])

export async function GET() {
  try {
    const session = await getSession()
    if (!session || !ROLES_TRASLADO.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('traslados')
      .select('*, bodega_origen:bodegas!bodega_origen_id(id,nombre), bodega_destino:bodegas!bodega_destino_id(id,nombre)')
      .eq('empresa_id', session.empresa_id)
      .order('fecha', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !ROLES_TRASLADO.has(session.rol)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await req.json()
    const { bodega_origen_id, bodega_destino_id, observaciones, lineas } = body

    if (!bodega_origen_id || !bodega_destino_id || bodega_origen_id === bodega_destino_id) {
      return NextResponse.json({ error: 'Bodegas origen y destino deben ser diferentes' }, { status: 400 })
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos una linea' }, { status: 400 })
    }

    const supabase = await createClient()
    const fecha = getTodayInAppTimeZone()
    await ensurePeriodoAbierto({
      session,
      fecha,
      source: 'api:inventario-traslados',
      method: req.method,
      route: '/api/inventario/traslados',
      context: { bodega_origen_id, bodega_destino_id, lineas: lineas.length },
    })

    // Get next numero
    const { data: maxRow } = await supabase
      .from('traslados')
      .select('numero')
      .eq('empresa_id', session.empresa_id)
      .order('numero', { ascending: false })
      .limit(1)
      .single()

    const numero = (maxRow?.numero ?? 0) + 1

    // Insert traslado header
    const { data: traslado, error: insertError } = await supabase
      .from('traslados')
      .insert({
        empresa_id: session.empresa_id,
        numero,
        bodega_origen_id,
        bodega_destino_id,
        observaciones: observaciones?.trim() || null,
        estado: 'pendiente',
        fecha,
        created_by: session.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Insert traslado lineas
    const lineasData = lineas.map((l: { producto_id: string; cantidad: number }) => ({
      traslado_id: traslado.id,
      producto_id: l.producto_id,
      cantidad: Number(l.cantidad),
    }))

    const { error: lineasError } = await supabase
      .from('traslados_lineas')
      .insert(lineasData)

    if (lineasError) throw lineasError

    // Execute stock movement via RPC
    const { error: rpcError } = await supabase.rpc('ejecutar_traslado', {
      p_traslado_id: traslado.id,
    })

    if (rpcError) throw rpcError

    revalidateInventoryDependentViews(session.empresa_id)

    return NextResponse.json(traslado, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
