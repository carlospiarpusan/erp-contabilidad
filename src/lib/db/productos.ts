import { createClient } from '@/lib/supabase/server'
import type { Producto } from '@/types'

export async function getProductos(params?: {
  busqueda?: string
  familia_id?: string
  fabricante_id?: string
  activo?: boolean
  con_stock_bajo?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, familia_id, fabricante_id, activo = true, con_stock_bajo, limit = 50, offset = 0 } = params ?? {}

  let query = supabase
    .from('productos')
    .select(`
      *,
      familia:familias(id, nombre),
      fabricante:fabricantes(id, nombre),
      impuesto:impuestos(id, codigo, porcentaje),
      stock(id, bodega_id, cantidad, cantidad_minima, bodega:bodegas(nombre))
    `, { count: 'exact' })
    .order('descripcion')
    .range(offset, offset + limit - 1)

  if (activo !== undefined) query = query.eq('activo', activo)
  if (familia_id) query = query.eq('familia_id', familia_id)
  if (fabricante_id) query = query.eq('fabricante_id', fabricante_id)
  if (busqueda) {
    query = query.or(
      `descripcion.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,codigo_barras.ilike.%${busqueda}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error
  return { productos: (data ?? []) as Producto[], total: count ?? 0 }
}

export async function getProductoById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .select(`
      *,
      familia:familias(id, nombre),
      fabricante:fabricantes(id, nombre),
      impuesto:impuestos(id, codigo, porcentaje),
      stock(*, bodega:bodegas(id, nombre)),
      variantes:producto_variantes(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Producto
}

export async function createProducto(datos: Partial<Producto>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert(datos)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

export async function updateProducto(id: string, datos: Partial<Producto>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .update({ ...datos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

export async function getFamilias() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getFabricantes() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getImpuestos() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('impuestos').select('*').order('porcentaje')
  if (error) throw error
  return data ?? []
}

export async function getBodegas() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('bodegas').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}

export async function getStockBajo(empresa_id?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_bajo')
    .select('*')
    .order('cantidad')

  if (error) throw error
  return data ?? []
}
