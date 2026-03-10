import {
  bootstrapEnv,
  buildDetalleMap,
  buildLineasFactura,
  chunk,
  createAdminClient,
  loadFacturaImportContext,
  readFacturasPayload,
} from './facturas_importadas_utils.mjs'

const log = (...args) => console.log('[reparar-facturas]', ...args)
const warn = (...args) => console.warn('[warn]', ...args)

bootstrapEnv()

const admin = createAdminClient()
const EID = process.env.EMPRESA_ID ?? '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const FACTURAS_PATH = process.env.FACTURAS_JSON_PATH || process.env.FACTURAS_DETALLE_JSON_PATH || ''
const DEFAULT_PREFIX = process.env.FACTURAS_PREFIJO ?? 'F'
const REPLACE_PLACEHOLDER_LINES =
  process.env.REPLACE_PLACEHOLDER_LINES === '1' ||
  process.env.REEMPLAZAR_PLACEHOLDERS === '1'

function isPlaceholderLine(description) {
  return String(description ?? '').startsWith('Venta importada sin detalle (')
}

async function getFacturasPendientesReparacion() {
  const facturas = []
  const pageSize = 500

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await admin
      .from('documentos')
      .select('id, numero, prefijo, fecha, total, subtotal, total_iva, total_descuento, total_costo, observaciones')
      .eq('empresa_id', EID)
      .eq('tipo', 'factura_venta')
      .ilike('observaciones', '%Coin In ERP%')
      .order('fecha', { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data?.length) break

    facturas.push(...data)
    if (data.length < pageSize) break
  }

  const ids = facturas.map((row) => row.id)
  if (!ids.length) return []

  const lineasPorDocumento = new Map()
  for (const idsChunk of chunk(ids, 200)) {
    const { data: lineas, error: lineasError } = await admin
      .from('documentos_lineas')
      .select('documento_id, descripcion')
      .in('documento_id', idsChunk)

    if (lineasError) throw lineasError
    for (const linea of lineas ?? []) {
      if (!lineasPorDocumento.has(linea.documento_id)) {
        lineasPorDocumento.set(linea.documento_id, [])
      }
      lineasPorDocumento.get(linea.documento_id).push(linea)
    }
  }

  return facturas
    .map((row) => {
      const lineas = lineasPorDocumento.get(row.id) ?? []
      const reemplazarPlaceholder =
        REPLACE_PLACEHOLDER_LINES &&
        lineas.length > 0 &&
        lineas.every((linea) => isPlaceholderLine(linea.descripcion))

      return {
        ...row,
        reemplazar_placeholder: reemplazarPlaceholder,
        sin_lineas: lineas.length === 0,
      }
    })
    .filter((row) => row.sin_lineas || row.reemplazar_placeholder)
}

async function main() {
  const context = await loadFacturaImportContext(admin, EID)
  const facturasPendientes = await getFacturasPendientesReparacion()

  if (!facturasPendientes.length) {
    log('No hay facturas importadas sin líneas por reparar')
    return
  }

  const detalleMap = FACTURAS_PATH
    ? buildDetalleMap(readFacturasPayload(FACTURAS_PATH), DEFAULT_PREFIX)
    : new Map()

  let totalLineas = 0
  let totalReales = 0
  let totalSinProducto = 0

  for (const documentosChunk of chunk(facturasPendientes, 100)) {
    const lineasChunk = []
    const reemplazos = documentosChunk
      .filter((documento) => documento.reemplazar_placeholder)
      .map((documento) => documento.id)

    if (reemplazos.length > 0) {
      const { error: deleteError } = await admin
        .from('documentos_lineas')
        .delete()
        .in('documento_id', reemplazos)

      if (deleteError) throw deleteError
    }

    for (const documento of documentosChunk) {
      const key = `${String(documento.prefijo ?? DEFAULT_PREFIX).trim().toUpperCase()}|${String(documento.numero ?? '').trim()}`
      const detalle = detalleMap.get(key)
      const lineas = buildLineasFactura(detalle, documento, context)

      totalLineas += lineas.length
      totalReales += lineas.filter((linea) => Boolean(linea.producto_id)).length
      totalSinProducto += lineas.filter((linea) => !linea.producto_id).length
      lineasChunk.push(...lineas)
    }

    if (lineasChunk.length === 0) continue

    const { error } = await admin.from('documentos_lineas').insert(lineasChunk)
    if (error) {
      warn(`chunk líneas: ${error.message}`)
      continue
    }

    log(`Chunk reparado: ${documentosChunk.length} facturas, ${lineasChunk.length} líneas`)
  }

  log(`✓ Facturas reparadas: ${facturasPendientes.length}`)
  log(`✓ Líneas creadas: ${totalLineas}`)
  log(`✓ Líneas con producto real: ${totalReales}`)
  log(`✓ Líneas sin producto mapeado: ${totalSinProducto}`)
  if (!FACTURAS_PATH) {
    log('Se usó fallback placeholder porque no se proporcionó JSON con detalle por ítem')
  }
  if (REPLACE_PLACEHOLDER_LINES) {
    log('Modo reemplazo activo: se reemplazaron placeholders existentes cuando aplicaba')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
