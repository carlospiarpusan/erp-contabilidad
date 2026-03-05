import { createClient } from '@/lib/supabase/server'
import type { Producto, Familia, Fabricante } from '@/types'
import { cleanUUIDs } from '@/lib/utils/db'

// ── Productos ────────────────────────────────────────────────

export async function getProductos(params?: {
  busqueda?: string
  familia_id?: string
  fabricante_id?: string
  activo?: boolean
  stock_bajo?: boolean
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()
  const { busqueda, familia_id, fabricante_id, activo = true, stock_bajo, limit = 50, offset = 0 } = params ?? {}

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

  let productos = (data ?? []) as Producto[]
  if (stock_bajo) {
    productos = productos.filter(p =>
      (p.stock ?? []).some(s => s.cantidad_minima > 0 && s.cantidad <= s.cantidad_minima)
    )
  }

  return { productos, total: stock_bajo ? productos.length : (count ?? 0) }
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
      producto_variantes(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Producto
}

export async function getEstadisticasInventario() {
  const supabase = await createClient()

  const [totalRes, activosRes, stockRes] = await Promise.all([
    supabase.from('productos').select('*', { count: 'exact', head: true }),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('stock').select('cantidad, cantidad_minima, producto_id'),
  ])

  const stockData = stockRes.data ?? []
  const stockBajo = stockData.filter(s => s.cantidad_minima > 0 && s.cantidad <= s.cantidad_minima).length
  const valorTotal = stockData.reduce((sum, s) => sum + (s.cantidad ?? 0), 0)

  return {
    total: totalRes.count ?? 0,
    activos: activosRes.count ?? 0,
    stockBajo,
    unidades: Math.round(valorTotal),
  }
}

export async function getMovimientosProducto(producto_id: string, limit = 15) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_movimientos')
    .select('*, bodega:bodegas(nombre)')
    .eq('producto_id', producto_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function createProducto(datos: Partial<Producto>) {
  const payload = cleanUUIDs({ ...datos }, ['familia_id', 'fabricante_id', 'impuesto_id', 'cuenta_venta_id', 'cuenta_compra_id', 'cuenta_inventario_id'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

export async function updateProducto(id: string, datos: Partial<Producto>) {
  const payload = cleanUUIDs({ ...datos }, ['familia_id', 'fabricante_id', 'impuesto_id', 'cuenta_venta_id', 'cuenta_compra_id', 'cuenta_inventario_id'])

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Producto
}

// ── Ajuste de stock ──────────────────────────────────────────

export async function ajustarStock(params: {
  producto_id: string
  bodega_id: string
  tipo: 'ajuste_positivo' | 'ajuste_negativo' | 'entrada_compra' | 'salida_venta' | 'ajuste_inventario'
  cantidad: number
  notas?: string
}) {
  const supabase = await createClient()
  const { producto_id, bodega_id, tipo, cantidad, notas } = params
  const delta = tipo === 'ajuste_negativo' || tipo === 'salida_venta' ? -Math.abs(cantidad) : Math.abs(cantidad)

  // Upsert stock
  const { error: stockError } = await supabase.rpc('actualizar_stock', {
    p_producto_id: producto_id,
    p_variante_id: null,
    p_bodega_id: bodega_id,
    p_delta: delta,
    p_tipo: tipo,
    p_doc_id: null,
  })

  if (stockError) {
    // Fallback: direct update
    const { data: existing } = await supabase
      .from('stock')
      .select('id, cantidad')
      .eq('producto_id', producto_id)
      .eq('bodega_id', bodega_id)
      .single()

    if (existing) {
      await supabase
        .from('stock')
        .update({ cantidad: Math.max(0, (existing.cantidad ?? 0) + delta) })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('stock')
        .insert({ producto_id, bodega_id, cantidad: Math.max(0, delta) })
    }

    // Insert movement manually
    await supabase.from('stock_movimientos').insert({
      producto_id, bodega_id,
      tipo, cantidad: delta,
      notas: notas || null,
    })
  }
}

// ── Maestros ─────────────────────────────────────────────────

export async function getFamilias() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').select('*, productos(count)').order('nombre')
  if (error) throw error
  return (data ?? []) as (Familia & { productos: { count: number }[] })[]
}

export async function createFamilia(datos: Partial<Familia>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').insert(datos).select().single()
  if (error) throw error
  return data as Familia
}

export async function updateFamilia(id: string, datos: Partial<Familia>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').update(datos).eq('id', id).select().single()
  if (error) throw error
  return data as Familia
}

export async function deleteFamilia(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('familias').delete().eq('id', id)
  if (error) throw error
}

export async function getFabricantes() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').select('*, productos(count)').order('nombre')
  if (error) throw error
  return (data ?? []) as (Fabricante & { productos: { count: number }[] })[]
}

export async function createFabricante(datos: Partial<Fabricante>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').insert(datos).select().single()
  if (error) throw error
  return data as Fabricante
}

export async function updateFabricante(id: string, datos: Partial<Fabricante>) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').update(datos).eq('id', id).select().single()
  if (error) throw error
  return data as Fabricante
}

export async function deleteFabricante(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('fabricantes').delete().eq('id', id)
  if (error) throw error
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

export async function getStockBajo() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('stock_bajo').select('*').order('cantidad')
  if (error) throw error
  return data ?? []
}
