import { createClient } from '@/lib/supabase/server'
import type { Producto, Familia, Fabricante } from '@/types'
import { cleanUUIDs } from '@/lib/utils/db'
import { getEmpresaId } from '@/lib/db/maestros'
import { hasLowStock, isLowStock } from '@/lib/utils/stock'

// ── Productos ────────────────────────────────────────────────

const PRODUCTOS_SELECT_FULL = `
  *,
  familia:familias(id, nombre),
  fabricante:fabricantes(id, nombre),
  impuesto:impuestos(id, codigo, porcentaje),
  stock(id, bodega_id, cantidad, cantidad_minima, bodega:bodegas(nombre))
`

const PRODUCTOS_SELECT_SELECTOR = 'id, codigo, descripcion, precio_venta, precio_compra, impuesto_id, activo'

type GetProductosParams = {
  busqueda?: string
  familia_id?: string
  fabricante_id?: string
  activo?: boolean
  stock_bajo?: boolean
  limit?: number
  offset?: number
  select_mode?: 'full' | 'selector'
  include_total?: boolean
}

export async function getProductos(params?: GetProductosParams) {
  const supabase = await createClient()
  const {
    busqueda,
    familia_id,
    fabricante_id,
    activo = true,
    stock_bajo,
    limit = 50,
    offset = 0,
    select_mode = 'full',
    include_total,
  } = params ?? {}

  const mode = stock_bajo ? 'full' : select_mode
  const needsTotal = (include_total ?? mode === 'full') && !stock_bajo
  const fields = mode === 'selector' ? PRODUCTOS_SELECT_SELECTOR : PRODUCTOS_SELECT_FULL

  const applyFilters = (query: any) => {
    if (activo !== undefined) query = query.eq('activo', activo)
    if (familia_id) query = query.eq('familia_id', familia_id)
    if (fabricante_id) query = query.eq('fabricante_id', fabricante_id)
    if (busqueda) {
      query = query.or(
        `descripcion.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%,codigo_barras.ilike.%${busqueda}%`
      )
    }
    return query
  }

  const dataQuery = applyFilters(
    supabase
    .from('productos')
    .select(fields)
    .order('descripcion')
    .range(offset, offset + limit - 1)
  )

  const [dataRes, countRes] = await Promise.all([
    dataQuery,
    needsTotal
      ? applyFilters(
        supabase
          .from('productos')
          .select('id', { count: 'exact', head: true })
      )
      : Promise.resolve(null),
  ])

  if (dataRes.error) throw dataRes.error
  if (countRes?.error) throw countRes.error

  let productos = (dataRes.data ?? []) as Producto[]
  if (stock_bajo) {
    productos = productos.filter(p => hasLowStock(p.stock))
  }

  const total = stock_bajo ? productos.length : (needsTotal ? (countRes?.count ?? 0) : productos.length)
  return { productos, total }
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

  const [totalRes, activosRes, productosRes] = await Promise.all([
    supabase.from('productos').select('*', { count: 'exact', head: true }),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('productos').select('id, stock(cantidad, cantidad_minima)').eq('activo', true),
  ])

  const productos = productosRes.data ?? []
  const stockBajo = productos.filter((p) => hasLowStock(p.stock)).length
  const valorTotal = productos.reduce((sum, p) => {
    const totalProducto = (Array.isArray(p.stock) ? p.stock : []).reduce((s, st) => s + (st.cantidad ?? 0), 0)
    return sum + totalProducto
  }, 0)

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
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...datos, empresa_id })

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
  const { id: _, ...rest } = datos
  const payload = cleanUUIDs(rest)

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

  const { error } = await supabase.rpc('secure_actualizar_stock', {
    p_producto_id: producto_id,
    p_variante_id: null,
    p_bodega_id: bodega_id,
    p_cantidad: delta,
    p_tipo: tipo,
    p_documento_id: null,
    p_precio_costo: 0,
    p_numero_lote: notas || null,
  })
  if (error) throw error
}

// ── Maestros ─────────────────────────────────────────────────

export async function getFamilias() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').select('*, productos(count)').order('nombre')
  if (error) throw error
  return (data ?? []) as (Familia & { productos: { count: number }[] })[]
}

export async function createFamilia(datos: Partial<Familia>) {
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...datos, empresa_id })
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').insert(payload).select().single()
  if (error) throw error
  return data as Familia
}

export async function updateFamilia(id: string, datos: Partial<Familia>) {
  const { id: _, ...rest } = datos
  const payload = cleanUUIDs(rest)
  const supabase = await createClient()
  const { data, error } = await supabase.from('familias').update(payload).eq('id', id).select().single()
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
  const empresa_id = await getEmpresaId()
  const payload = cleanUUIDs({ ...datos, empresa_id })
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').insert(payload).select().single()
  if (error) throw error
  return data as Fabricante
}

export async function updateFabricante(id: string, datos: Partial<Fabricante>) {
  const { id: _, ...rest } = datos
  const payload = cleanUUIDs(rest)
  const supabase = await createClient()
  const { data, error } = await supabase.from('fabricantes').update(payload).eq('id', id).select().single()
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
  const { data, error } = await supabase
    .from('productos')
    .select('id, codigo, descripcion, stock(id, bodega_id, cantidad, cantidad_minima, bodega:bodegas(nombre))')
    .eq('activo', true)
    .order('descripcion')

  if (error) throw error

  const filas: Array<Record<string, unknown>> = []
  for (const p of data ?? []) {
    const stocks = Array.isArray(p.stock) ? p.stock : []
    if (stocks.length === 0) {
      filas.push({
        id: `sin-stock-${p.id}`,
        producto_id: p.id,
        bodega_id: null,
        cantidad: 0,
        cantidad_minima: 0,
        bodega: { nombre: 'Sin bodega' },
        codigo: p.codigo,
        descripcion: p.descripcion,
      })
      continue
    }
    for (const s of stocks) {
      if (!isLowStock(s)) continue
      filas.push({
        ...s,
        codigo: p.codigo,
        descripcion: p.descripcion,
      })
    }
  }

  return filas
}
