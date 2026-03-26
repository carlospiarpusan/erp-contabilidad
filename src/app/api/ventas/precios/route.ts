import { NextRequest, NextResponse } from 'next/server'
import { toErrorMsg } from '@/lib/utils/errors'
import { createClient } from '@/lib/supabase/server'
import { getEmpresaId } from '@/lib/db/maestros'
import { getSession } from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listas_precios')
      .select('*, producto:producto_id(codigo, descripcion), cliente:cliente_id(razon_social), grupo:grupo_id(nombre)')
      .order('nombre')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const body = await req.json()
    const { nombre, tipo, producto_id, cliente_id, grupo_id, precio, descuento_porcentaje, valida_desde, valida_hasta } = body
    if (!nombre || !producto_id) {
      return NextResponse.json({ error: 'Nombre y producto son requeridos' }, { status: 400 })
    }
    const empresa_id = await getEmpresaId()
    const supabase   = await createClient()
    const { data, error } = await supabase
      .from('listas_precios')
      .insert({
        empresa_id,
        nombre,
        tipo:                  tipo || null,
        producto_id,
        cliente_id:            cliente_id   || null,
        grupo_id:              grupo_id     || null,
        precio:                precio       || null,
        descuento_porcentaje:  descuento_porcentaje || null,
        valida_desde:          valida_desde  || null,
        valida_hasta:          valida_hasta  || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: toErrorMsg(e) }, { status: 500 })
  }
}
