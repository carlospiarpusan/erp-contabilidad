import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }  = await params
    const body    = await req.json()
    const supabase = await createClient()
    const { nombre, tipo, producto_id, cliente_id, grupo_id, precio, descuento_porcentaje, valida_desde, valida_hasta } = body
    const { data, error } = await supabase
      .from('listas_precios')
      .update({
        nombre,
        tipo:                 tipo              || null,
        producto_id,
        cliente_id:           cliente_id        || null,
        grupo_id:             grupo_id          || null,
        precio:               precio            || null,
        descuento_porcentaje: descuento_porcentaje || null,
        valida_desde:         valida_desde       || null,
        valida_hasta:         valida_hasta       || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { error } = await supabase.from('listas_precios').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}
