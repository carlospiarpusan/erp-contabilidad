import { createClient } from '@/lib/supabase/server'
import { unstable_noStore as noStore } from 'next/cache'
import type { Producto, Familia, Fabricante } from '@/types'
import { cleanUUIDs } from '@/lib/utils/db'
import { getEmpresaId } from '@/lib/db/maestros'
import { hasLowStock, isLowStock } from '@/lib/utils/stock'

type StockMetricRow = {
  cantidad?: number | null
  cantidad_minima?: number | null
}

type ProductoSinRotacionRow = {
  id: string
  codigo: string
  descripcion: string
  precio_venta?: number | null
  precio_compra?: number | null
  familia?: { nombre?: string } | null
  stock?: Array<{
    cantidad?: number | null
    cantidad_minima?: number | null
    bodega?: { nombre?: string } | null
  }> | null
}

type VentaHistorialProducto = {
  producto_id: string
  fecha: string
  cantidad: number
}

export interface ProductoSinRotacion {
  id: string
  codigo: string
  descripcion: string
  familia?: { nombre?: string } | null
  stock_actual: number
  stock_minimo: number
  ventas_periodo: number
  ultima_venta: string | null
  dias_sin_venta: number | null
  precio_compra: number
  precio_venta: number
  valor_stock: number
}

function formatISODate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function startDateFromDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return formatISODate(date)
}

function diffDays(from: string, to = new Date()) {
  const fromDate = new Date(`${from}T00:00:00`)
  const ms = to.getTime() - fromDate.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

function toNumber(value: unknown) {
  return Number(value ?? 0)
}

function shouldFallbackVentasProducto(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message ?? '') : ''
  return code === '42P01' || code === '42501' || message.includes('ventas_producto_diarias')
}

function shouldFallbackAjusteStockObjetivo(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message ?? '') : ''
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('secure_ajustar_stock_objetivo') ||
    message.includes('Could not find the function public.secure_ajustar_stock_objetivo')
  )
}

async function getVentasHistorialProductos(desdeHistorico: string) {
  const supabase = await createClient()
  const empresaId = await getEmpresaId()

  try {
    const { data, error } = await supabase
      .from('ventas_producto_diarias')
      .select('producto_id, fecha, cantidad_total')
      .eq('empresa_id', empresaId)
      .gte('fecha', desdeHistorico)

    if (error) throw error

    return ((data ?? []) as Array<{ producto_id?: string | null; fecha?: string | null; cantidad_total?: number | null }>)
      .filter((row) => row.producto_id && row.fecha)
      .map((row) => ({
        producto_id: String(row.producto_id),
        fecha: String(row.fecha),
        cantidad: Number(row.cantidad_total ?? 0),
      })) satisfies VentaHistorialProducto[]
  } catch (error) {
    if (!shouldFallbackVentasProducto(error)) throw error

    const { data, error: rawError } = await supabase
      .from('documentos_lineas')
      .select('producto_id, cantidad, documento:documentos!inner(fecha, empresa_id, tipo, estado)')
      .eq('documento.empresa_id', empresaId)
      .eq('documento.tipo', 'factura_venta')
      .neq('documento.estado', 'cancelada')
      .gte('documento.fecha', desdeHistorico)
      .not('producto_id', 'is', null)

    if (rawError) throw rawError

    return ((data ?? []) as Array<{
      producto_id?: string | null
      cantidad?: number | null
      documento?: { fecha?: string | null } | Array<{ fecha?: string | null }> | null
    }>)
      .flatMap((row) => {
        const documento = Array.isArray(row.documento) ? row.documento[0] : row.documento
        if (!row.producto_id || !documento?.fecha) return []
        return [{
          producto_id: String(row.producto_id),
          fecha: String(documento.fecha),
          cantidad: Number(row.cantidad ?? 0),
        }]
      })
  }
}

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
  noStore()
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

  let dataQuery = applyFilters(
    supabase
      .from('productos')
      .select(fields)
      .order('descripcion')
  )
  if (!stock_bajo) {
    dataQuery = dataQuery.range(offset, offset + limit - 1)
  }

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
    const totalFiltrados = productos.length
    const paged = productos.slice(offset, offset + limit)
    return { productos: paged, total: totalFiltrados }
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
  noStore()
  const supabase = await createClient()
  const [totalRes, activosRes, productosActivosRes, stockRes, sinRotacion] = await Promise.all([
    supabase.from('productos').select('*', { count: 'exact', head: true }),
    supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase
      .from('productos')
      .select('id, stock(cantidad, cantidad_minima)')
      .eq('activo', true),
    supabase
      .from('stock')
      .select('cantidad, producto:producto_id!inner(activo)')
      .eq('producto.activo', true),
    getProductosSinRotacion({ days: 90, limit: 5000 }),
  ])

  if (productosActivosRes.error) throw productosActivosRes.error
  if (stockRes.error) throw stockRes.error

  const stockBajo = (productosActivosRes.data ?? []).filter((producto) =>
    hasLowStock((producto as { stock?: StockMetricRow[] }).stock)
  ).length

  const unidades = Math.round(
    (stockRes.data ?? []).reduce((sum, row) => sum + Number(row.cantidad ?? 0), 0)
  )

  return {
    total: totalRes.count ?? 0,
    activos: activosRes.count ?? 0,
    stockBajo,
    sinRotacion: sinRotacion.length,
    unidades,
  }
}

export async function getProductosSinRotacion(params?: {
  days?: number
  historyDays?: number
  limit?: number
}) {
  noStore()
  const supabase = await createClient()
  const days = Math.max(30, Math.min(params?.days ?? 90, 365))
  const historyDays = Math.max(days, Math.min(params?.historyDays ?? 730, 1460))
  const limit = Math.max(10, Math.min(params?.limit ?? 200, 5000))
  const desdeVentana = startDateFromDays(days)
  const desdeHistorico = startDateFromDays(historyDays)

  const [{ data: productos, error }, ventas] = await Promise.all([
    supabase
      .from('productos')
      .select(`
        id,
        codigo,
        descripcion,
        precio_venta,
        precio_compra,
        familia:familia_id(nombre),
        stock(
          cantidad,
          cantidad_minima,
          bodega:bodegas(nombre)
        )
      `)
      .eq('activo', true)
      .order('descripcion'),
    getVentasHistorialProductos(desdeHistorico),
  ])

  if (error) throw error

  const ventasPorProducto = ventas.reduce((acc, row) => {
    const current = acc.get(row.producto_id) ?? {
      ventas_periodo: 0,
      ultima_venta: null as string | null,
    }

    if (row.fecha >= desdeVentana) {
      current.ventas_periodo += Number(row.cantidad ?? 0)
    }
    if (!current.ultima_venta || row.fecha > current.ultima_venta) {
      current.ultima_venta = row.fecha
    }

    acc.set(row.producto_id, current)
    return acc
  }, new Map<string, { ventas_periodo: number; ultima_venta: string | null }>())

  return ((productos ?? []) as ProductoSinRotacionRow[])
    .map((producto) => {
      const stocks = Array.isArray(producto.stock) ? producto.stock : []
      const stock_actual = stocks.reduce((sum, stock) => sum + toNumber(stock.cantidad), 0)
      const stock_minimo = stocks.reduce((sum, stock) => sum + toNumber(stock.cantidad_minima), 0)
      const ventasProducto = ventasPorProducto.get(producto.id)
      const ventas_periodo = Number(ventasProducto?.ventas_periodo ?? 0)
      const ultima_venta = ventasProducto?.ultima_venta ?? null

      return {
        id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        familia: producto.familia ?? null,
        stock_actual,
        stock_minimo,
        ventas_periodo,
        ultima_venta,
        dias_sin_venta: ultima_venta ? diffDays(ultima_venta) : null,
        precio_compra: toNumber(producto.precio_compra),
        precio_venta: toNumber(producto.precio_venta),
        valor_stock: Math.round(stock_actual * Math.max(toNumber(producto.precio_compra), 0)),
      } satisfies ProductoSinRotacion
    })
    .filter((producto) => producto.stock_actual > 0 && producto.ventas_periodo <= 0)
    .sort((a, b) => {
      if (b.valor_stock !== a.valor_stock) return b.valor_stock - a.valor_stock
      if (b.stock_actual !== a.stock_actual) return b.stock_actual - a.stock_actual
      return a.descripcion.localeCompare(b.descripcion, 'es')
    })
    .slice(0, limit)
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

export async function deleteProducto(id: string) {
  const supabase = await createClient()

  const [productoRes, lineasRes, movimientosRes, stockRes] = await Promise.all([
    supabase
      .from('productos')
      .select('id, activo')
      .eq('id', id)
      .single(),
    supabase
      .from('documentos_lineas')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', id),
    supabase
      .from('stock_movimientos')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', id),
    supabase
      .from('stock')
      .select('cantidad')
      .eq('producto_id', id),
  ])

  if (productoRes.error || !productoRes.data) {
    throw new Error(productoRes.error?.message ?? 'Producto no encontrado')
  }
  if (lineasRes.error) throw new Error(lineasRes.error.message ?? 'Error al revisar líneas del producto')
  if (movimientosRes.error) throw new Error(movimientosRes.error.message ?? 'Error al revisar movimientos del producto')
  if (stockRes.error) throw new Error(stockRes.error.message ?? 'Error al revisar stock del producto')

  const lineasRelacionadas = Number(lineasRes.count ?? 0)
  const movimientosRelacionados = Number(movimientosRes.count ?? 0)
  const stockActual = (stockRes.data ?? []).reduce((sum, row) => sum + Number(row.cantidad ?? 0), 0)
  const debeDesactivar = lineasRelacionadas > 0 || movimientosRelacionados > 0 || stockActual !== 0

  if (debeDesactivar) {
    const { data, error } = await supabase
      .from('productos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, activo')
      .single()

    if (error) throw new Error(error.message ?? 'Error al desactivar producto')

    return {
      mode: 'deactivated' as const,
      producto: data as Producto,
      message: 'El producto tiene stock o movimientos relacionados y fue desactivado en lugar de eliminarse.',
    }
  }

  const { error: deleteError } = await supabase
    .from('productos')
    .delete()
    .eq('id', id)

  if (!deleteError) {
    return {
      mode: 'deleted' as const,
      message: 'Producto eliminado correctamente.',
    }
  }

  if (deleteError.code === '23503') {
    const { data, error: updateError } = await supabase
      .from('productos')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, activo')
      .single()

    if (updateError) throw new Error(updateError.message ?? 'Error al desactivar producto')

    return {
      mode: 'deactivated' as const,
      producto: data as Producto,
      message: 'El producto tiene referencias históricas y fue desactivado en lugar de eliminarse.',
    }
  }

  throw new Error(deleteError.message ?? 'Error al eliminar producto')
}

// ── Ajuste de stock ──────────────────────────────────────────

export async function ajustarStock(params: {
  producto_id: string
  bodega_id: string
  tipo: 'ajuste_positivo' | 'ajuste_negativo' | 'entrada_compra' | 'salida_venta' | 'ajuste_inventario'
  cantidad: number
  notas?: string
  stock_objetivo?: number
}) {
  const supabase = await createClient()
  const { producto_id, bodega_id, tipo, cantidad, notas, stock_objetivo } = params
  const empresaId = await getEmpresaId()

  if (!bodega_id?.trim()) {
    throw new Error('No se puede ajustar inventario sin una bodega seleccionada.')
  }

  const { data: bodega, error: bodegaError } = await supabase
    .from('bodegas')
    .select('id, activa')
    .eq('empresa_id', empresaId)
    .eq('id', bodega_id)
    .maybeSingle()

  if (bodegaError) throw bodegaError
  if (!bodega) {
    throw new Error('La bodega seleccionada no existe o no pertenece a la empresa.')
  }
  if (bodega.activa === false) {
    throw new Error('La bodega seleccionada está inactiva. Actívala o elige otra bodega.')
  }

  let delta = tipo === 'ajuste_negativo' || tipo === 'salida_venta' ? -Math.abs(cantidad) : Math.abs(cantidad)
  let stockActual: number | null = null
  let stockFinal: number | null = null
  let stockObjetivo: number | null = null

  if (tipo === 'ajuste_inventario') {
    const objetivo = Number(stock_objetivo ?? cantidad)
    if (!Number.isFinite(objetivo) || objetivo < 0) {
      throw new Error('Cantidad objetivo inválida para ajuste de inventario')
    }

    const { data, error: ajusteError } = await supabase.rpc('secure_ajustar_stock_objetivo', {
      p_producto_id: producto_id,
      p_variante_id: null,
      p_bodega_id: bodega_id,
      p_stock_objetivo: objetivo,
      p_notas: notas || null,
    })

    if (ajusteError && !shouldFallbackAjusteStockObjetivo(ajusteError)) throw ajusteError

    if (!ajusteError) {
      const result = Array.isArray(data) ? data[0] : data
      stockActual = Number(result?.stock_antes ?? 0)
      delta = Number(result?.delta ?? 0)
      stockObjetivo = objetivo
      stockFinal = Number(result?.stock_despues ?? objetivo)

      return {
        mode: Math.abs(delta) < 0.000001 ? 'noop' as const : 'applied' as const,
        delta,
        stock_actual: stockActual,
        stock_final: stockFinal,
        stock_objetivo: stockObjetivo,
      }
    }

    const { data: stockRows, error: stockError } = await supabase
      .from('stock')
      .select('cantidad')
      .eq('producto_id', producto_id)
      .eq('bodega_id', bodega_id)
      .is('variante_id', null)

    if (stockError) throw stockError

    stockActual = (stockRows ?? []).reduce((sum, row) => sum + Number(row.cantidad ?? 0), 0)
    delta = objetivo - stockActual
    stockObjetivo = objetivo
    stockFinal = objetivo

    if (Math.abs(delta) < 0.000001) {
      return {
        mode: 'noop' as const,
        delta: 0,
        stock_actual: stockActual,
        stock_objetivo: objetivo,
        stock_final: stockFinal,
      }
    }
  }

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

  const { data: stockRowsFinal, error: stockFinalError } = await supabase
    .from('stock')
    .select('cantidad')
    .eq('producto_id', producto_id)
    .eq('bodega_id', bodega_id)
    .is('variante_id', null)

  if (stockFinalError) throw stockFinalError

  const stockFinalReal = (stockRowsFinal ?? []).reduce((sum, row) => sum + Number(row.cantidad ?? 0), 0)

  if (stockActual == null) {
    stockActual = stockFinalReal - delta
  }
  stockFinal = stockFinalReal

  if (
    stockObjetivo != null &&
    Math.abs(stockFinalReal - stockObjetivo) >= 0.000001
  ) {
    throw new Error(
      `El ajuste no se pudo verificar. Stock final: ${stockFinalReal}. Stock esperado: ${stockObjetivo}.`
    )
  }

  return {
    mode: 'applied' as const,
    delta,
    stock_actual: stockActual,
    stock_final: stockFinal,
    stock_objetivo: stockObjetivo,
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
  noStore()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .select(`
      id,
      codigo,
      descripcion,
      precio_venta,
      familia:familia_id(nombre),
      stock(
        id,
        bodega_id,
        cantidad,
        cantidad_minima,
        bodega:bodegas(nombre)
      )
    `)
    .eq('activo', true)
    .order('descripcion')

  if (error) throw error

  return (data ?? []).flatMap((producto) => {
    const productoRow = producto as {
      id: string
      codigo: string
      descripcion: string
      precio_venta?: number | null
      familia?: { nombre?: string } | null
      stock?: Array<{
        id?: string | null
        bodega_id?: string | null
        cantidad?: number | null
        cantidad_minima?: number | null
        bodega?: { nombre?: string } | null
      }> | null
    }

    const stocks = productoRow.stock ?? []

    if (stocks.length === 0) {
      return [{
        id: `sin-stock-${productoRow.id}`,
        producto_id: productoRow.id,
        bodega_id: null,
        cantidad: 0,
        cantidad_minima: 0,
        codigo: productoRow.codigo,
        descripcion: productoRow.descripcion,
        bodega: { nombre: 'Sin stock configurado' },
        precio_venta: Number(productoRow.precio_venta ?? 0),
        familia: productoRow.familia ?? null,
      }]
    }

    return stocks
      .filter(isLowStock)
      .map((stock) => ({
        id: stock.id ?? `stock-${productoRow.id}-${stock.bodega_id ?? 'sin-bodega'}`,
        producto_id: productoRow.id,
        bodega_id: stock.bodega_id ?? null,
        cantidad: Number(stock.cantidad ?? 0),
        cantidad_minima: Number(stock.cantidad_minima ?? 0),
        codigo: productoRow.codigo,
        descripcion: productoRow.descripcion,
        bodega: { nombre: stock.bodega?.nombre ?? 'Sin bodega' },
        precio_venta: Number(productoRow.precio_venta ?? 0),
        familia: productoRow.familia ?? null,
      }))
  })
}
