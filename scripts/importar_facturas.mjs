import {
  bootstrapEnv,
  buildDetalleMap,
  buildDocumentoPayload,
  buildLineasFactura,
  chunk,
  createAdminClient,
  loadFacturaImportContext,
  readFacturasPayload,
} from './facturas_importadas_utils.mjs'

const log = (...args) => console.log('[facturas]', ...args)
const warn = (...args) => console.warn('[warn]', ...args)

bootstrapEnv()

const admin = createAdminClient()
const EID = process.env.EMPRESA_ID ?? '948ce6fc-6337-4f39-9e80-7b2c0ce0166c'
const FACTURAS_PATH = process.env.FACTURAS_JSON_PATH ?? '/tmp/facturas.json'
const DEFAULT_PREFIX = process.env.FACTURAS_PREFIJO ?? 'F'

async function main() {
  const facturas = readFacturasPayload(FACTURAS_PATH)
  log(`${facturas.length} facturas a importar desde ${FACTURAS_PATH}`)

  const context = await loadFacturaImportContext(admin, EID)
  const detalleMap = buildDetalleMap(facturas, DEFAULT_PREFIX)

  let totalFacturas = 0
  let totalLineas = 0
  let totalSinProducto = 0

  for (const facturasChunk of chunk(facturas, 100)) {
    const docsPayload = facturasChunk.map((factura) =>
      buildDocumentoPayload(factura, context, EID, DEFAULT_PREFIX)
    )

    const { data: docsInsertados, error: docsError } = await admin
      .from('documentos')
      .insert(docsPayload)
      .select('id, numero, prefijo, total, subtotal, total_iva, total_descuento, total_costo')

    if (docsError) {
      warn(`chunk facturas: ${docsError.message}`)
      continue
    }

    totalFacturas += docsInsertados.length

    const documentosPorKey = new Map(
      docsInsertados.map((documento) => [
        `${String(documento.prefijo ?? '').trim().toUpperCase()}|${String(documento.numero ?? '').trim()}`,
        documento,
      ])
    )

    const lineasChunk = []
    for (const factura of facturasChunk) {
      const key = `${String(factura.prefijo ?? DEFAULT_PREFIX).trim().toUpperCase()}|${String(factura.numero ?? '').trim()}`
      const documento = documentosPorKey.get(key)
      if (!documento) {
        warn(`No se pudo ubicar el documento insertado para ${key}`)
        continue
      }

      const detalle = detalleMap.get(key) ?? factura
      const lineas = buildLineasFactura(detalle, documento, context)
      totalSinProducto += lineas.filter((linea) => !linea.producto_id).length
      totalLineas += lineas.length
      lineasChunk.push(...lineas)
    }

    if (lineasChunk.length > 0) {
      const { error: lineasError } = await admin.from('documentos_lineas').insert(lineasChunk)
      if (lineasError) {
        warn(`chunk líneas: ${lineasError.message}`)
      }
    }

    log(`Chunk: ${docsInsertados.length} facturas, ${lineasChunk.length} líneas`)
  }

  log(`✓ Total facturas importadas: ${totalFacturas}`)
  log(`✓ Total líneas creadas: ${totalLineas}`)
  log(`✓ Líneas sin producto mapeado: ${totalSinProducto}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
