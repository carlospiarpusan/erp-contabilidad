import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEjercicioActivo } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'
import { toErrorMsg } from '@/lib/utils/errors'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const desde  = searchParams.get('desde') ?? `${new Date().getFullYear()}-01-01`
    const hasta  = searchParams.get('hasta') ?? new Date().toISOString().split('T')[0]
    const limit  = parseInt(searchParams.get('limit') ?? '50')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const { data, error, count } = await supabase
      .from('documentos')
      .select(`
        id, numero, prefijo, fecha, total, estado, motivo, documento_origen_id,
        cliente:cliente_id(razon_social, numero_documento),
        factura_origen:documento_origen_id(numero, prefijo)
      `, { count: 'exact' })
      .eq('tipo', 'nota_credito')
      .gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ notas: data ?? [], total: count ?? 0 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await req.json()
    const { factura_id, motivo, lineas } = body

    if (!factura_id || !lineas?.length) {
      return NextResponse.json({ error: 'Campos requeridos: factura_id y al menos una línea' }, { status: 400 })
    }
    if (!motivo?.trim()) {
      return NextResponse.json({ error: 'El motivo es requerido' }, { status: 400 })
    }

    const ejercicio = await getEjercicioActivo()
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('secure_crear_nota_credito', {
      p_ejercicio_id: ejercicio.id,
      p_factura_id:   factura_id,
      p_motivo:       motivo.trim(),
      p_lineas:       lineas,
    })

    if (error) throw error
    return NextResponse.json({ id: data }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
