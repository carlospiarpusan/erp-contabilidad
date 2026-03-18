import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Falta la variable de entorno requerida: ${name}`)
  return value
}

function optionalEnv(name, fallback = '') {
  const value = process.env[name]?.trim()
  return value || fallback
}

function parseBoolean(value, fallback = false) {
  if (!value) return fallback
  return ['1', 'true', 'yes', 'si'].includes(value.trim().toLowerCase())
}

function parseCsv(raw, separator = ';') {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0]
    .split(separator)
    .map((header) => header.trim().replace(/^\uFEFF/, ''))

  return lines.slice(1).map((line) => {
    const values = line.split(separator)
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? '']))
  })
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

function parseStock(value) {
  const parsed = Number.parseInt(String(value ?? '0').trim(), 10)
  if (!Number.isFinite(parsed)) return 0
  return parsed === 7777 ? 9999 : parsed
}

function chunk(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
const ADMIN_EMAIL = requiredEnv('INVENTARIO_ADMIN_EMAIL')
const INVENTARIO_FILE = optionalEnv('INVENTARIO_FILE', '/tmp/productos.xlsx')
const INVENTARIO_FECHA = optionalEnv('INVENTARIO_FECHA', '2026-01-01')
const INVENTARIO_BODEGA_ID = optionalEnv('INVENTARIO_BODEGA_ID', '')
const DRY_RUN = parseBoolean(optionalEnv('INVENTARIO_DRY_RUN', '0'))
const ALLOW_UNMATCHED = parseBoolean(optionalEnv('INVENTARIO_ALLOW_UNMATCHED', '0'))
const RESET_MOVIMIENTOS = parseBoolean(optionalEnv('INVENTARIO_RESET_MOVIMIENTOS', '0'))

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const log = (...args) => console.log('[inventario-inicial]', ...args)

async function resolveContext() {
  const { data: usuarios, error: usuarioError } = await admin
    .from('usuarios')
    .select('id, empresa_id, nombre, email')
    .eq('email', ADMIN_EMAIL)
    .limit(2)

  if (usuarioError) throw usuarioError
  if (!usuarios || usuarios.length === 0) {
    throw new Error(`No existe un usuario con email ${ADMIN_EMAIL}`)
  }
  if (usuarios.length > 1) {
    throw new Error(`El email ${ADMIN_EMAIL} está asociado a más de una empresa`)
  }

  const usuario = usuarios[0]

  const { data: empresa, error: empresaError } = await admin
    .from('empresas')
    .select('id, nombre, nit')
    .eq('id', usuario.empresa_id)
    .single()

  if (empresaError) throw empresaError

  let bodegaQuery = admin
    .from('bodegas')
    .select('id, nombre, principal')
    .eq('empresa_id', empresa.id)
    .limit(1)

  if (INVENTARIO_BODEGA_ID) {
    bodegaQuery = bodegaQuery.eq('id', INVENTARIO_BODEGA_ID)
  } else {
    bodegaQuery = bodegaQuery.order('principal', { ascending: false })
  }

  const { data: bodega, error: bodegaError } = await bodegaQuery.single()
  if (bodegaError) throw bodegaError

  return { usuario, empresa, bodega }
}

function loadInventoryRows() {
  if (!existsSync(INVENTARIO_FILE)) {
    throw new Error(`No existe el archivo de inventario: ${INVENTARIO_FILE}`)
  }

  const raw = readFileSync(INVENTARIO_FILE, 'utf-8')
  const rows = parseCsv(raw, ';')

  return rows
    .filter((row) => normalizeKey(row.Descripcion) || normalizeKey(row.Codigo))
    .map((row) => ({
      codigo: normalizeKey(row.Codigo),
      descripcion: normalizeKey(row.Descripcion),
      cantidad: parseStock(row.Stock),
    }))
}

async function loadCompanyProducts(empresaId, bodegaId) {
  const { data: productos, error: productosError } = await admin
    .from('productos')
    .select('id, codigo, descripcion, precio_compra')
    .eq('empresa_id', empresaId)

  if (productosError) throw productosError

  const productIds = (productos ?? []).map((producto) => producto.id)
  const minimaPorProducto = new Map()

  for (const ids of chunk(productIds, 200)) {
    const { data: stocks, error: stockError } = await admin
      .from('stock')
      .select('producto_id, cantidad_minima')
      .eq('bodega_id', bodegaId)
      .in('producto_id', ids)

    if (stockError) throw stockError

    for (const stock of stocks ?? []) {
      const currentMin = Number(minimaPorProducto.get(stock.producto_id) ?? 0)
      const nextMin = Number(stock.cantidad_minima ?? 0)
      minimaPorProducto.set(stock.producto_id, Math.max(currentMin, nextMin))
    }
  }

  return {
    productos: productos ?? [],
    minimaPorProducto,
  }
}

function buildTargetInventory(productos, minimaPorProducto, inventoryRows) {
  const byCode = new Map()
  const byDescription = new Map()

  for (const producto of productos) {
    const codigo = normalizeKey(producto.codigo)
    const descripcion = normalizeKey(producto.descripcion)
    if (codigo) byCode.set(codigo, producto)
    if (descripcion) byDescription.set(descripcion, producto)
  }

  const agregados = new Map()
  const unmatchedRows = []

  for (const row of inventoryRows) {
    const producto = (row.codigo && byCode.get(row.codigo)) || byDescription.get(row.descripcion)
    if (!producto) {
      unmatchedRows.push(row)
      continue
    }

    const current = agregados.get(producto.id) ?? {
      producto_id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      cantidad: 0,
      precio_costo: Number(producto.precio_compra ?? 0),
      cantidad_minima: Number(minimaPorProducto.get(producto.id) ?? 0),
    }

    current.cantidad += row.cantidad
    agregados.set(producto.id, current)
  }

  return {
    targetRows: Array.from(agregados.values()),
    unmatchedRows,
  }
}

async function deleteInChunks(table, companyProductIds, bodegaId) {
  for (const ids of chunk(companyProductIds, 200)) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq('bodega_id', bodegaId)
      .in('producto_id', ids)

    if (error) throw error
  }
}

async function resetInventory({ empresa, usuario, bodega, targetRows, companyProductIds }) {
  if (RESET_MOVIMIENTOS) {
    log('Eliminando movimientos de stock existentes de la bodega objetivo…')
    await deleteInChunks('stock_movimientos', companyProductIds, bodega.id)
  }

  log('Eliminando stock existente de la bodega objetivo…')
  await deleteInChunks('stock', companyProductIds, bodega.id)

  const stockRows = targetRows.map((row) => ({
    producto_id: row.producto_id,
    variante_id: null,
    bodega_id: bodega.id,
    cantidad: row.cantidad,
    cantidad_minima: row.cantidad_minima,
  }))

  const movimientoRows = targetRows
    .filter((row) => row.cantidad > 0)
    .map((row) => ({
      empresa_id: empresa.id,
      producto_id: row.producto_id,
      variante_id: null,
      bodega_id: bodega.id,
      tipo: 'ajuste_inventario',
      cantidad: row.cantidad,
      stock_antes: 0,
      stock_despues: row.cantidad,
      precio_costo: row.precio_costo,
      numero_lote: null,
      created_by: usuario.id,
      created_at: `${INVENTARIO_FECHA}T05:00:00.000Z`,
    }))

  for (const rows of chunk(stockRows, 200)) {
    const { error } = await admin.from('stock').insert(rows)
    if (error) throw error
  }

  for (const rows of chunk(movimientoRows, 200)) {
    const { error } = await admin.from('stock_movimientos').insert(rows)
    if (error) throw error
  }
}

async function main() {
  const context = await resolveContext()
  const inventoryRows = loadInventoryRows()
  const { productos, minimaPorProducto } = await loadCompanyProducts(context.empresa.id, context.bodega.id)
  const { targetRows, unmatchedRows } = buildTargetInventory(productos, minimaPorProducto, inventoryRows)

  log(`Empresa: ${context.empresa.nombre} (${context.empresa.id})`)
  log(`Admin: ${context.usuario.email} (${context.usuario.id})`)
  log(`Bodega: ${context.bodega.nombre} (${context.bodega.id})`)
  log(`Archivo: ${INVENTARIO_FILE}`)
  log(`Fecha base: ${INVENTARIO_FECHA}`)
  log(`Productos empresa: ${productos.length}`)
  log(`Filas archivo: ${inventoryRows.length}`)
  log(`Productos a cargar: ${targetRows.length}`)
  log(`Filas sin match: ${unmatchedRows.length}`)

  if (unmatchedRows.length > 0) {
    console.log(JSON.stringify(unmatchedRows.slice(0, 20), null, 2))
    if (!ALLOW_UNMATCHED) {
      throw new Error('Hay filas de inventario sin producto asociado. Usa INVENTARIO_ALLOW_UNMATCHED=1 si quieres continuar.')
    }
  }

  if (DRY_RUN) {
    log('Dry run completado. No se hicieron cambios.')
    return
  }

  await resetInventory({
    empresa: context.empresa,
    usuario: context.usuario,
    bodega: context.bodega,
    targetRows,
    companyProductIds: productos.map((producto) => producto.id),
  })

  log(`Inventario inicial cargado para ${targetRows.length} productos.`)
  log(`Movimientos ${RESET_MOVIMIENTOS ? 'reiniciados' : 'conservados'} en la bodega objetivo.`)
}

main().catch((error) => {
  console.error('[inventario-inicial][error]', error.message)
  process.exit(1)
})
