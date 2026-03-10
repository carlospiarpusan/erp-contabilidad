import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function loadEnvFile(fileName) {
  const fullPath = resolve(process.cwd(), fileName)
  if (!existsSync(fullPath)) return

  const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) process.env[key] = value
  }
}

export function bootstrapEnv() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
}

export function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Falta variable de entorno: ${name}`)
  return value
}

export function createAdminClient() {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY')

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function chunk(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

export function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

export function safeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value
      .replace(/\s+/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export function maybeNumber(value) {
  const marker = Symbol('nan')
  const parsed = safeNumber(value, marker)
  return parsed === marker ? Number.NaN : parsed
}

export function normalizeText(value) {
  return String(value ?? '').trim()
}

export function normalizeCode(value) {
  return normalizeText(value).toUpperCase()
}

export function normalizeLooseCode(value) {
  return normalizeCode(value).replace(/[^A-Z0-9]/g, '')
}

export function normalizeDescription(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

export function normalizeDocRef(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/\s+/g, '')
}

export function getFacturaKey(input, defaultPrefix = 'F') {
  const prefijo = normalizeCode(input?.prefijo || defaultPrefix)
  const numero = normalizeText(input?.numero)
  if (!numero) return null
  return `${prefijo}|${numero}`
}

export function readFacturasPayload(filePath) {
  const fullPath = resolve(process.cwd(), filePath)
  const raw = JSON.parse(readFileSync(fullPath, 'utf8'))
  if (Array.isArray(raw)) return raw
  if (Array.isArray(raw?.facturas)) return raw.facturas
  throw new Error(`Formato inválido en ${fullPath}: se esperaba arreglo o { facturas: [] }`)
}

export async function ensureConsumidorFinal(admin, empresaId) {
  let { data: cliente, error } = await admin
    .from('clientes')
    .select('id')
    .eq('empresa_id', empresaId)
    .ilike('razon_social', '%CONSUMIDOR FINAL%')
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (cliente) return cliente.id

  const { data: creado, error: insertError } = await admin
    .from('clientes')
    .insert({
      empresa_id: empresaId,
      razon_social: 'CONSUMIDOR FINAL',
      tipo_documento: 'CC',
      numero_documento: '222222222',
      activo: true,
    })
    .select('id')
    .single()

  if (insertError) throw insertError
  return creado.id
}

export async function ensureProveedor(admin, empresaId, razonSocial) {
  const nombre = normalizeText(razonSocial)
  if (!nombre) throw new Error('Proveedor inválido: razón social vacía')

  let { data: proveedor, error } = await admin
    .from('proveedores')
    .select('id, razon_social')
    .eq('empresa_id', empresaId)
    .ilike('razon_social', nombre)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (proveedor) return proveedor

  const { data: creado, error: insertError } = await admin
    .from('proveedores')
    .insert({
      empresa_id: empresaId,
      razon_social: nombre,
      activo: true,
    })
    .select('id, razon_social')
    .single()

  if (insertError) throw insertError
  return creado
}

export async function loadFacturaImportContext(admin, empresaId) {
  const [
    serieRes,
    bodegaRes,
    ejerciciosRes,
    formaPagoRes,
    impuestosRes,
    productosRes,
  ] = await Promise.all([
    admin.from('consecutivos').select('id, prefijo').eq('empresa_id', empresaId).eq('tipo', 'factura_venta').limit(1).single(),
    admin.from('bodegas').select('id').eq('empresa_id', empresaId).limit(1).single(),
    admin.from('ejercicios').select('id, año').eq('empresa_id', empresaId),
    admin.from('formas_pago').select('id, descripcion').eq('empresa_id', empresaId).eq('descripcion', 'Efectivo').limit(1).single(),
    admin.from('impuestos').select('id, codigo, porcentaje').eq('empresa_id', empresaId),
    admin.from('productos').select('id, codigo, descripcion, precio_compra').eq('empresa_id', empresaId),
  ])

  if (serieRes.error) throw serieRes.error
  if (bodegaRes.error) throw bodegaRes.error
  if (ejerciciosRes.error) throw ejerciciosRes.error
  if (formaPagoRes.error) throw formaPagoRes.error
  if (impuestosRes.error) throw impuestosRes.error
  if (productosRes.error) throw productosRes.error

  const consumidorFinalId = await ensureConsumidorFinal(admin, empresaId)

  const ejerciciosPorAnio = Object.fromEntries(
    (ejerciciosRes.data ?? []).map((ejercicio) => [String(ejercicio.año), ejercicio.id])
  )

  const impuestosPorPorcentaje = new Map(
    (impuestosRes.data ?? []).map((impuesto) => [Number(impuesto.porcentaje ?? 0), impuesto.id])
  )

  const productosPorCodigo = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeText(producto.codigo))
      .map((producto) => [normalizeCode(producto.codigo), producto])
  )

  const productosPorCodigoLoose = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeLooseCode(producto.codigo))
      .map((producto) => [normalizeLooseCode(producto.codigo), producto])
  )

  const descripcionesConConteo = new Map()
  for (const producto of productosRes.data ?? []) {
    const key = normalizeDescription(producto.descripcion)
    if (!key) continue
    descripcionesConConteo.set(key, (descripcionesConConteo.get(key) ?? 0) + 1)
  }

  const productosPorDescripcion = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeDescription(producto.descripcion))
      .filter((producto) => descripcionesConConteo.get(normalizeDescription(producto.descripcion)) === 1)
      .map((producto) => [normalizeDescription(producto.descripcion), producto])
  )

  const productosPorId = new Map(
    (productosRes.data ?? []).map((producto) => [producto.id, producto])
  )

  return {
    serieId: serieRes.data.id,
    prefijo: normalizeText(serieRes.data.prefijo) || 'F',
    bodegaId: bodegaRes.data.id,
    formaPagoId: formaPagoRes.data.id,
    consumidorFinalId,
    ejerciciosPorAnio,
    impuestosPorPorcentaje,
    productosPorCodigo,
    productosPorCodigoLoose,
    productosPorDescripcion,
    productosPorId,
  }
}

export async function loadCompraImportContext(admin, empresaId) {
  const [
    bodegaRes,
    ejerciciosRes,
    impuestosRes,
    productosRes,
    proveedoresRes,
  ] = await Promise.all([
    admin.from('bodegas').select('id').eq('empresa_id', empresaId).limit(1).single(),
    admin.from('ejercicios').select('id, año').eq('empresa_id', empresaId),
    admin.from('impuestos').select('id, codigo, porcentaje').eq('empresa_id', empresaId),
    admin.from('productos').select('id, codigo, descripcion, precio_compra').eq('empresa_id', empresaId),
    admin.from('proveedores').select('id, razon_social').eq('empresa_id', empresaId),
  ])

  if (bodegaRes.error) throw bodegaRes.error
  if (ejerciciosRes.error) throw ejerciciosRes.error
  if (impuestosRes.error) throw impuestosRes.error
  if (productosRes.error) throw productosRes.error
  if (proveedoresRes.error) throw proveedoresRes.error

  const ejerciciosPorAnio = Object.fromEntries(
    (ejerciciosRes.data ?? []).map((ejercicio) => [String(ejercicio.año), ejercicio.id])
  )

  const impuestosPorPorcentaje = new Map(
    (impuestosRes.data ?? []).map((impuesto) => [Number(impuesto.porcentaje ?? 0), impuesto.id])
  )

  const productosPorCodigo = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeText(producto.codigo))
      .map((producto) => [normalizeCode(producto.codigo), producto])
  )

  const productosPorCodigoLoose = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeLooseCode(producto.codigo))
      .map((producto) => [normalizeLooseCode(producto.codigo), producto])
  )

  const descripcionesConConteo = new Map()
  for (const producto of productosRes.data ?? []) {
    const key = normalizeDescription(producto.descripcion)
    if (!key) continue
    descripcionesConConteo.set(key, (descripcionesConConteo.get(key) ?? 0) + 1)
  }

  const productosPorDescripcion = new Map(
    (productosRes.data ?? [])
      .filter((producto) => normalizeDescription(producto.descripcion))
      .filter((producto) => descripcionesConConteo.get(normalizeDescription(producto.descripcion)) === 1)
      .map((producto) => [normalizeDescription(producto.descripcion), producto])
  )

  const productosPorId = new Map(
    (productosRes.data ?? []).map((producto) => [producto.id, producto])
  )

  const proveedoresPorNombre = new Map(
    (proveedoresRes.data ?? [])
      .filter((proveedor) => normalizeDescription(proveedor.razon_social))
      .map((proveedor) => [normalizeDescription(proveedor.razon_social), proveedor])
  )

  return {
    bodegaId: bodegaRes.data.id,
    ejerciciosPorAnio,
    impuestosPorPorcentaje,
    productosPorCodigo,
    productosPorCodigoLoose,
    productosPorDescripcion,
    productosPorId,
    proveedoresPorNombre,
  }
}

export function buildDocumentoPayload(factura, context, empresaId, defaultPrefix = 'F') {
  const fecha = normalizeText(factura?.fecha) || '2025-01-01'
  const anio = fecha.slice(0, 4)
  const prefijo = normalizeText(factura?.prefijo) || defaultPrefix
  const total = round2(safeNumber(factura?.total, 0))
  const subtotal = round2(safeNumber(factura?.subtotal, total))
  const totalIva = round2(safeNumber(factura?.total_iva, 0))
  const totalDescuento = round2(safeNumber(factura?.total_descuento, 0))
  const totalCosto = round2(safeNumber(factura?.total_costo, 0))

  return {
    empresa_id: empresaId,
    tipo: 'factura_venta',
    numero: Number(factura.numero),
    prefijo,
    serie_id: context.serieId,
    cliente_id: factura?.cliente_id || context.consumidorFinalId,
    bodega_id: factura?.bodega_id || context.bodegaId,
    ejercicio_id: factura?.ejercicio_id || context.ejerciciosPorAnio[anio] || null,
    forma_pago_id: factura?.forma_pago_id || context.formaPagoId,
    fecha,
    fecha_vencimiento: normalizeText(factura?.vence || factura?.fecha_vencimiento) || null,
    total,
    subtotal,
    total_iva: totalIva,
    total_descuento: totalDescuento,
    total_costo: totalCosto,
    estado: normalizeText(factura?.estado) || 'pagada',
    observaciones: normalizeText(factura?.observaciones) || 'Importado desde Coin In ERP',
  }
}

function resolveProducto(linea, context) {
  const rawProductoId = normalizeText(linea?.producto_id)
  if (UUID_REGEX.test(rawProductoId)) {
    return context.productosPorId.get(rawProductoId) ?? { id: rawProductoId, codigo: '', descripcion: '', precio_compra: 0 }
  }

  const posiblesCodigos = [
    linea?.codigo,
    linea?.producto_codigo,
    linea?.codigo_producto,
    linea?.sku,
  ]

  for (const codigo of posiblesCodigos) {
    const normalizedCode = normalizeCode(codigo)
    const normalizedLooseCode = normalizeLooseCode(codigo)
    const found =
      context.productosPorCodigo.get(normalizedCode) ??
      context.productosPorCodigoLoose.get(normalizedLooseCode)
    if (found) return found
  }

  const posiblesDescripciones = [
    linea?.descripcion,
    linea?.nombre,
  ]

  for (const descripcion of posiblesDescripciones) {
    const found = context.productosPorDescripcion.get(normalizeDescription(descripcion))
    if (found) return found
  }

  return null
}

function resolveImpuestoId(linea, context) {
  const rawImpuestoId = normalizeText(linea?.impuesto_id)
  if (UUID_REGEX.test(rawImpuestoId)) return rawImpuestoId

  const porcentaje = maybeNumber(
    linea?.iva_porcentaje ??
    linea?.porcentaje_iva ??
    linea?.iva ??
    linea?.impuesto_porcentaje,
  )

  if (Number.isFinite(porcentaje)) {
    return context.impuestosPorPorcentaje.get(Number(porcentaje)) ?? null
  }

  return null
}

function buildPlaceholderLine(documento) {
  return {
    documento_id: documento.id,
    producto_id: null,
    variante_id: null,
    descripcion: `Venta importada sin detalle (${documento.prefijo}${documento.numero})`,
    cantidad: 1,
    precio_unitario: round2(safeNumber(documento.subtotal, documento.total)),
    precio_costo: round2(safeNumber(documento.total_costo, 0)),
    descuento_porcentaje: 0,
    impuesto_id: null,
    subtotal: round2(safeNumber(documento.subtotal, documento.total)),
    total_descuento: round2(safeNumber(documento.total_descuento, 0)),
    total_iva: round2(safeNumber(documento.total_iva, 0)),
    total: round2(safeNumber(documento.total, 0)),
    orden: 0,
  }
}

function buildRealLine(linea, index, documento, context) {
  const producto = resolveProducto(linea, context)
  const cantidad = Math.max(0.001, safeNumber(linea?.cantidad, 1))

  const subtotalDirecto = maybeNumber(linea?.subtotal)
  const precioUnitarioDirecto = maybeNumber(
    linea?.precio_unitario ??
    linea?.precio ??
    linea?.valor_unitario
  )
  const precio_unitario = Number.isFinite(precioUnitarioDirecto)
    ? precioUnitarioDirecto
    : (Number.isFinite(subtotalDirecto) ? subtotalDirecto / cantidad : safeNumber(documento.subtotal, documento.total))

  const subtotal = round2(Number.isFinite(subtotalDirecto) ? subtotalDirecto : cantidad * precio_unitario)
  const descuento_porcentaje = safeNumber(linea?.descuento_porcentaje, 0)
  const totalDescuentoDirecto = maybeNumber(linea?.total_descuento)
  const total_descuento = round2(
    Number.isFinite(totalDescuentoDirecto)
      ? totalDescuentoDirecto
      : subtotal * descuento_porcentaje / 100
  )
  const impuesto_id = resolveImpuestoId(linea, context)
  const totalIvaDirecto = maybeNumber(linea?.total_iva)
  const total_iva = round2(
    Number.isFinite(totalIvaDirecto)
      ? totalIvaDirecto
      : 0
  )
  const totalDirecto = maybeNumber(linea?.total)
  const total = round2(
    Number.isFinite(totalDirecto)
      ? totalDirecto
      : subtotal - total_descuento + total_iva
  )

  return {
    documento_id: documento.id,
    producto_id: producto?.id ?? null,
    variante_id: UUID_REGEX.test(normalizeText(linea?.variante_id)) ? normalizeText(linea?.variante_id) : null,
    descripcion: normalizeText(linea?.descripcion || linea?.nombre || producto?.descripcion) || `Ítem importado ${index + 1}`,
    cantidad,
    precio_unitario: round2(precio_unitario),
    precio_costo: round2(safeNumber(linea?.precio_costo, safeNumber(producto?.precio_compra, 0))),
    descuento_porcentaje: round2(descuento_porcentaje),
    impuesto_id,
    subtotal,
    total_descuento,
    total_iva,
    total,
    orden: index,
  }
}

export function buildLineasFactura(detalle, documento, context) {
  const lineas = Array.isArray(detalle?.lineas) ? detalle.lineas : []
  if (!lineas.length) return [buildPlaceholderLine(documento)]
  return lineas.map((linea, index) => buildRealLine(linea, index, documento, context))
}

export function buildDetalleMap(facturas, defaultPrefix = 'F') {
  const map = new Map()
  for (const factura of facturas) {
    const key = getFacturaKey(factura, defaultPrefix)
    if (!key) continue
    map.set(key, factura)
  }
  return map
}
