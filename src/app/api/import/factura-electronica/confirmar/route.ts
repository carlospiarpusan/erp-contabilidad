import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEjercicioActivo } from '@/lib/db/maestros'
import { getSession, puedeAcceder } from '@/lib/auth/session'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidateInventoryDependentViews } from '@/lib/cache/revalidate-inventory'
import { buildDescripcionConCodigo } from '@/lib/import/factura-electronica-shared'

type LineaConfirmada = {
  descripcion: string
  codigo_pdf: string
  gtin?: string | null
  standard_scheme_id?: string | null
  standard_scheme_name?: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  subtotal_neto?: number
  total_descuento?: number
  descuento_porcentaje?: number
  iva: number
  total: number
  porcentaje_iva?: number
  accion: 'usar_existente' | 'crear_nuevo'
  producto_id?: string | null
  nuevo_codigo?: string
  nueva_descripcion?: string
  nuevo_precio_venta?: number
  persistir_gtin?: boolean
}

type ProductoBase = {
  id: string
  codigo: string
  codigo_barras: string | null
  descripcion: string
  precio_compra: number | null
  precio_venta: number | null
  impuesto_id: string | null
}

type ImpuestoDisponible = {
  id: string
  porcentaje: number | null
}

type LineaPreparada = {
  descripcion_original: string
  descripcion_importacion: string
  codigo_pdf: string | null
  gtin: string | null
  cantidad: number
  precio_unitario: number
  subtotal: number
  subtotal_neto: number
  total_descuento: number
  descuento_porcentaje: number
  iva: number
  total: number
  porcentaje_iva: number
  impuesto_id: string | null
  accion: 'usar_existente' | 'crear_nuevo'
  producto_id: string | null
  nuevo_codigo: string | null
  nueva_descripcion: string | null
  nuevo_precio_venta: number | null
  persistir_gtin: boolean
}

type DocumentoLineaPersistida = {
  id: string
  descripcion: string | null
  cantidad: number | null
  precio_unitario: number | null
  descuento_porcentaje: number | null
  producto: {
    id: string
    codigo: string
    descripcion: string | null
    descripcion_larga: string | null
  } | Array<{
    id: string
    codigo: string
    descripcion: string | null
    descripcion_larga: string | null
  }> | null
}

type ProductoDetallePersistido = {
  id: string
  codigo: string
  codigo_barras: string | null
  descripcion: string | null
  precio_compra: number | null
  precio_venta: number | null
  impuesto: {
    porcentaje: number | null
  } | Array<{
    porcentaje: number | null
  }> | null
}

type ProductoCreadoResumen = {
  id: string
  codigo: string
  descripcion: string
  codigo_barras: string | null
  cantidad_importada: number
  lineas_importadas: number
  precio_compra: number
  precio_venta: number
  porcentaje_iva: number
  total_descuento: number
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
}

function normalizeText(value: string | null | undefined) {
  const trimmed = (value ?? '').trim()
  return trimmed || null
}

function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function normalizePercentage(value: number | null | undefined) {
  const percentage = roundMoney(Number(value ?? 0))
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`Descuento invalido: ${value}`)
  }
  return percentage
}

function buildProductDisplayDescription(code: string | null | undefined, description: string | null | undefined) {
  const current = normalizeText(description)
  if (!current) return normalizeCode(code) || ''
  return buildDescripcionConCodigo(code, current)
}

function buildLineMatchKey(params: {
  descripcion: string | null | undefined
  cantidad: number | null | undefined
  precio_unitario: number | null | undefined
  descuento_porcentaje: number | null | undefined
}) {
  return [
    normalizeText(params.descripcion) ?? '',
    roundMoney(Number(params.cantidad ?? 0)),
    roundMoney(Number(params.precio_unitario ?? 0)),
    normalizePercentage(params.descuento_porcentaje),
  ].join('|')
}

function buildLineBaseMatchKey(params: {
  descripcion: string | null | undefined
  cantidad: number | null | undefined
  precio_unitario: number | null | undefined
}) {
  return [
    normalizeText(params.descripcion) ?? '',
    roundMoney(Number(params.cantidad ?? 0)),
    roundMoney(Number(params.precio_unitario ?? 0)),
  ].join('|')
}

function isValidDateRange(fecha: string, inicio: string, fin: string) {
  return fecha >= inicio && fecha <= fin
}

function getErrorStatus(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: string }).code ?? '')
    if (code === 'P0001' || code.startsWith('23')) return 400
  }
  return 500
}

function buildObservaciones(base: string | undefined, fechaOriginal: string | undefined, numeroExterno: string) {
  const lines = [normalizeText(base)]

  if (fechaOriginal) {
    lines.push(`Importada desde factura electronica XML/ZIP/PDF. Fecha original DIAN: ${fechaOriginal}. Numero externo: ${numeroExterno}.`)
  } else {
    lines.push(`Importada desde factura electronica XML/ZIP/PDF. Numero externo: ${numeroExterno}.`)
  }

  return lines.filter(Boolean).join('\n')
}

function normalizeDocumentoLineaProducto(linea: DocumentoLineaPersistida) {
  if (Array.isArray(linea.producto)) {
    return linea.producto[0] ?? null
  }
  return linea.producto ?? null
}

function normalizeProductoImpuesto(producto: ProductoDetallePersistido) {
  if (Array.isArray(producto.impuesto)) {
    return producto.impuesto[0] ?? null
  }
  return producto.impuesto ?? null
}

function resolveImpuestoId(impuestos: ImpuestoDisponible[], porcentajeIva?: number) {
  const porcentaje = Number(porcentajeIva ?? 0)
  const exact = impuestos.find((item) => Number(item.porcentaje ?? 0) === porcentaje)
  if (exact) return exact.id
  if (porcentaje === 0) return null
  throw new Error(`No existe un impuesto configurado para IVA ${porcentaje}% en la empresa`)
}

async function prepareLineasImportacion(params: {
  admin: ReturnType<typeof createServiceClient>
  empresaId: string
  impuestos: ImpuestoDisponible[]
  lineas: LineaConfirmada[]
}): Promise<LineaPreparada[]> {
  const existingProductIds = [...new Set(
    params.lineas
      .filter((linea) => linea.accion === 'usar_existente' && linea.producto_id)
      .map((linea) => linea.producto_id!)
  )]

  const existingProducts = existingProductIds.length
    ? await params.admin
      .from('productos')
      .select('id, codigo')
      .eq('empresa_id', params.empresaId)
      .in('id', existingProductIds)
    : { data: [] as Array<Pick<ProductoBase, 'id' | 'codigo'>>, error: null }

  if (existingProducts.error) throw existingProducts.error

  const productCodeById = new Map(
    ((existingProducts.data ?? []) as Array<Pick<ProductoBase, 'id' | 'codigo'>>)
      .map((producto) => [producto.id, producto.codigo])
  )

  return params.lineas.map((linea) => {
    const cantidad = roundMoney(Number(linea.cantidad))
    const precioUnitario = roundMoney(Number(linea.precio_unitario))
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new Error(`Cantidad invalida en la linea "${linea.descripcion}"`)
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      throw new Error(`Precio invalido en la linea "${linea.descripcion}"`)
    }

    const subtotalBruto = roundMoney(Number(linea.subtotal ?? cantidad * precioUnitario))
    const descuentoPorcentaje = normalizePercentage(linea.descuento_porcentaje)
    const totalDescuento = roundMoney(
      Number(linea.total_descuento ?? (subtotalBruto * descuentoPorcentaje) / 100)
    )
    const subtotalNeto = roundMoney(
      Number(linea.subtotal_neto ?? subtotalBruto - totalDescuento)
    )
    const totalIva = roundMoney(Number(linea.iva ?? 0))
    const total = roundMoney(Number(linea.total ?? subtotalNeto + totalIva))
    const impuestoId = resolveImpuestoId(params.impuestos, linea.porcentaje_iva)
    const codigoInterno = linea.accion === 'usar_existente'
      ? productCodeById.get(linea.producto_id ?? '')
      : normalizeCode(linea.nuevo_codigo)

    if (!codigoInterno) {
      throw new Error(`No se pudo resolver el codigo interno para la linea "${linea.descripcion}"`)
    }

    return {
      descripcion_original: normalizeText(linea.descripcion) ?? codigoInterno,
      descripcion_importacion: buildDescripcionConCodigo(codigoInterno, normalizeText(linea.descripcion) ?? codigoInterno),
      codigo_pdf: normalizeCode(linea.codigo_pdf) || null,
      gtin: normalizeDigits(linea.gtin) || null,
      cantidad,
      precio_unitario: precioUnitario,
      subtotal: subtotalBruto,
      subtotal_neto: subtotalNeto,
      total_descuento: totalDescuento,
      descuento_porcentaje: descuentoPorcentaje,
      iva: totalIva,
      total,
      porcentaje_iva: roundMoney(Number(linea.porcentaje_iva ?? 0)),
      impuesto_id: impuestoId,
      accion: linea.accion,
      producto_id: linea.producto_id ?? null,
      nuevo_codigo: normalizeCode(linea.nuevo_codigo) || null,
      nueva_descripcion: normalizeText(linea.nueva_descripcion) ?? null,
      nuevo_precio_venta: linea.nuevo_precio_venta != null ? roundMoney(Number(linea.nuevo_precio_venta)) : null,
      persistir_gtin: Boolean(linea.persistir_gtin),
    } satisfies LineaPreparada
  })
}

async function postProcessImportedCompra(params: {
  admin: ReturnType<typeof createServiceClient>
  documentoId: string
  lineas: LineaPreparada[]
}) {
  const [
    docLineRes,
    stockMovRes,
    asientoRes,
  ] = await Promise.all([
    params.admin
      .from('documentos_lineas')
      .select('id, descripcion, cantidad, precio_unitario, descuento_porcentaje, producto:producto_id(id, codigo, descripcion, descripcion_larga)')
      .eq('documento_id', params.documentoId),
    params.admin
      .from('stock_movimientos')
      .select('id, producto_id, cantidad')
      .eq('documento_id', params.documentoId)
      .order('created_at')
      .order('id'),
    params.admin
      .from('asientos')
      .select('id')
      .eq('documento_id', params.documentoId),
  ])

  if (docLineRes.error) throw docLineRes.error
  if (stockMovRes.error) throw stockMovRes.error
  if (asientoRes.error) throw asientoRes.error

  const unmatchedDocLines = [...((docLineRes.data ?? []) as unknown as DocumentoLineaPersistida[])]

  const stockQueues = new Map<string, Array<{ id: string; producto_id: string; cantidad: number | null }>>()
  for (const row of stockMovRes.data ?? []) {
    const key = `${row.producto_id}|${roundMoney(Number(row.cantidad ?? 0))}`
    const bucket = stockQueues.get(key) ?? []
    bucket.push(row)
    stockQueues.set(key, bucket)
  }

  let subtotal = 0
  let totalDescuento = 0
  let totalIva = 0
  let total = 0
  const productPatches = new Map<string, Record<string, unknown>>()

  for (const linea of params.lineas) {
    const lineKey = buildLineMatchKey({
      descripcion: linea.descripcion_importacion,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      descuento_porcentaje: linea.descuento_porcentaje,
    })
    const baseLineKey = buildLineBaseMatchKey({
      descripcion: linea.descripcion_importacion,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
    })

    let docLineIndex = unmatchedDocLines.findIndex((row) => (
      buildLineMatchKey({
        descripcion: row.descripcion,
        cantidad: row.cantidad,
        precio_unitario: row.precio_unitario,
        descuento_porcentaje: row.descuento_porcentaje,
      }) === lineKey
    ))

    if (docLineIndex === -1) {
      docLineIndex = unmatchedDocLines.findIndex((row) => (
        buildLineBaseMatchKey({
          descripcion: row.descripcion,
          cantidad: row.cantidad,
          precio_unitario: row.precio_unitario,
        }) === baseLineKey
      ))
    }

    const [docLine] = docLineIndex >= 0
      ? unmatchedDocLines.splice(docLineIndex, 1)
      : []

    const productoLinea = docLine ? normalizeDocumentoLineaProducto(docLine) : null

    if (!productoLinea?.id || !productoLinea.codigo) {
      throw new Error(`No se pudo localizar la linea importada "${linea.descripcion_importacion}" para sincronizar costo`)
    }

    const netCost = linea.cantidad > 0
      ? roundMoney(linea.subtotal_neto / linea.cantidad)
      : roundMoney(linea.precio_unitario)

    const { error: updateLineError } = await params.admin
      .from('documentos_lineas')
      .update({
        descripcion: linea.descripcion_importacion,
        precio_unitario: linea.precio_unitario,
        precio_costo: netCost,
        descuento_porcentaje: linea.descuento_porcentaje,
        impuesto_id: linea.impuesto_id,
        subtotal: linea.subtotal,
        total_descuento: linea.total_descuento,
        total_iva: linea.iva,
        total: linea.total,
      })
      .eq('id', docLine.id)

    if (updateLineError) throw updateLineError

    const stockKey = `${productoLinea.id}|${roundMoney(linea.cantidad)}`
    const stockQueue = stockQueues.get(stockKey) ?? []
    const stockMove = stockQueue.shift()
    stockQueues.set(stockKey, stockQueue)
    if (stockMove) {
      const { error: updateStockError } = await params.admin
        .from('stock_movimientos')
        .update({ precio_costo: netCost })
        .eq('id', stockMove.id)
      if (updateStockError) throw updateStockError
    }

    const canonicalDescription = normalizeText(linea.descripcion_original)
      ?? normalizeText(productoLinea.descripcion_larga)
      ?? normalizeText(productoLinea.descripcion)
      ?? productoLinea.codigo
    const productDescription = buildProductDisplayDescription(
      productoLinea.codigo,
      canonicalDescription
    )

    productPatches.set(productoLinea.id, {
      precio_compra: netCost,
      impuesto_id: linea.impuesto_id,
      descripcion: productDescription,
      descripcion_larga: canonicalDescription,
      updated_at: new Date().toISOString(),
    })

    subtotal += linea.subtotal
    totalDescuento += linea.total_descuento
    totalIva += linea.iva
    total += linea.total
  }

  for (const [productoId, patch] of productPatches.entries()) {
    const { error: updateProductError } = await params.admin
      .from('productos')
      .update(patch)
      .eq('id', productoId)
    if (updateProductError) throw updateProductError
  }

  subtotal = roundMoney(subtotal)
  totalDescuento = roundMoney(totalDescuento)
  totalIva = roundMoney(totalIva)
  total = roundMoney(total)

  const { error: updateDocError } = await params.admin
    .from('documentos')
    .update({
      subtotal,
      total_descuento: totalDescuento,
      total_iva: totalIva,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.documentoId)

  if (updateDocError) throw updateDocError

  for (const asiento of asientoRes.data ?? []) {
    const { error: updateAsientoError } = await params.admin
      .from('asientos')
      .update({ importe: total })
      .eq('id', asiento.id)
    if (updateAsientoError) throw updateAsientoError

    const { data: asientoLineas, error: asientoLineasError } = await params.admin
      .from('asientos_lineas')
      .select('id, descripcion')
      .eq('asiento_id', asiento.id)
    if (asientoLineasError) throw asientoLineasError

    for (const asientoLinea of asientoLineas ?? []) {
      let patch: { debe?: number; haber?: number } | null = null
      if (asientoLinea.descripcion === 'Entrada de mercancía') {
        patch = { debe: subtotal, haber: 0 }
      } else if (asientoLinea.descripcion === 'IVA Descontable') {
        patch = { debe: totalIva, haber: 0 }
      } else if (asientoLinea.descripcion === 'Deuda con proveedor') {
        patch = { debe: 0, haber: total }
      }
      if (!patch) continue

      const { error: updateAsientoLineaError } = await params.admin
        .from('asientos_lineas')
        .update(patch)
        .eq('id', asientoLinea.id)
      if (updateAsientoLineaError) throw updateAsientoLineaError
    }
  }
}

async function collectCreatedProductsSummary(params: {
  admin: ReturnType<typeof createServiceClient>
  empresaId: string
  lineas: LineaPreparada[]
}): Promise<ProductoCreadoResumen[]> {
  const statsByCode = new Map<string, {
    cantidad_importada: number
    lineas_importadas: number
    total_descuento: number
  }>()

  for (const linea of params.lineas) {
    if (linea.accion !== 'crear_nuevo') continue
    const code = normalizeCode(linea.nuevo_codigo)
    if (!code) continue

    const current = statsByCode.get(code) ?? {
      cantidad_importada: 0,
      lineas_importadas: 0,
      total_descuento: 0,
    }

    current.cantidad_importada = roundMoney(current.cantidad_importada + linea.cantidad)
    current.lineas_importadas += 1
    current.total_descuento = roundMoney(current.total_descuento + linea.total_descuento)
    statsByCode.set(code, current)
  }

  const codes = [...statsByCode.keys()]
  if (!codes.length) return []

  const { data, error } = await params.admin
    .from('productos')
    .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto:impuesto_id(porcentaje)')
    .eq('empresa_id', params.empresaId)
    .in('codigo', codes)

  if (error) throw error

  const productosByCode = new Map(
    ((data ?? []) as ProductoDetallePersistido[]).map((producto) => [normalizeCode(producto.codigo), producto])
  )

  return codes.flatMap((code) => {
    const producto = productosByCode.get(code)
    if (!producto) return []

    const stats = statsByCode.get(code)
    if (!stats) return []

    const impuesto = normalizeProductoImpuesto(producto)

    return [{
      id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion ?? producto.codigo,
      codigo_barras: producto.codigo_barras,
      cantidad_importada: stats.cantidad_importada,
      lineas_importadas: stats.lineas_importadas,
      precio_compra: roundMoney(Number(producto.precio_compra ?? 0)),
      precio_venta: roundMoney(Number(producto.precio_venta ?? 0)),
      porcentaje_iva: roundMoney(Number(impuesto?.porcentaje ?? 0)),
      total_descuento: stats.total_descuento,
    }]
  })
}

async function confirmWithFallback(params: {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
  proveedor_id: string
  bodega_id: string
  fecha_contabilizacion: string
  fecha_original?: string
  numero_externo: string
  observaciones?: string
  lineas: LineaPreparada[]
  ejercicio: { id: string; fecha_inicio: string | Date; fecha_fin: string | Date }
}): Promise<{ id: string; createdProducts: ProductoCreadoResumen[] }> {
  const admin = createServiceClient()
  const supabase = await createClient()
  const empresaId = params.session.empresa_id
  const numeroExterno = params.numero_externo.trim()

  const lineasConProducto = params.lineas.filter((linea) => linea.accion === 'usar_existente' && linea.producto_id)
  const lineasNuevas = params.lineas.filter((linea) => linea.accion === 'crear_nuevo')
  const existingProductIds = [...new Set(lineasConProducto.map((linea) => linea.producto_id!))]
  const requestedBarcodes = [...new Set(params.lineas.map((linea) => normalizeDigits(linea.gtin)).filter(Boolean))]
  const requestedCodes = [...new Set(lineasNuevas.map((linea) => normalizeCode(linea.nuevo_codigo)).filter(Boolean))]

  const [
    proveedorRes,
    bodegaRes,
    productosExistentesRes,
    impuestosRes,
    barcodeRes,
    codeRes,
    duplicateDocRes,
  ] = await Promise.all([
    admin
      .from('proveedores')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('id', params.proveedor_id)
      .maybeSingle(),
    admin
      .from('bodegas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('id', params.bodega_id)
      .maybeSingle(),
    existingProductIds.length
      ? admin
        .from('productos')
        .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto_id')
        .eq('empresa_id', empresaId)
        .in('id', existingProductIds)
      : Promise.resolve({ data: [] as ProductoBase[], error: null }),
    admin
      .from('impuestos')
      .select('id, porcentaje')
      .eq('empresa_id', empresaId),
    requestedBarcodes.length
      ? admin
        .from('productos')
        .select('id, codigo, codigo_barras')
        .eq('empresa_id', empresaId)
        .in('codigo_barras', requestedBarcodes)
      : Promise.resolve({ data: [] as Array<Pick<ProductoBase, 'id' | 'codigo' | 'codigo_barras'>>, error: null }),
    requestedCodes.length
      ? admin
        .from('productos')
        .select('id, codigo')
        .eq('empresa_id', empresaId)
        .in('codigo', requestedCodes)
      : Promise.resolve({ data: [] as Array<Pick<ProductoBase, 'id' | 'codigo'>>, error: null }),
    admin
      .from('documentos')
      .select('id, numero_externo')
      .eq('empresa_id', empresaId)
      .eq('tipo', 'factura_compra')
      .eq('proveedor_id', params.proveedor_id)
      .ilike('numero_externo', numeroExterno)
      .limit(1),
  ])

  if (proveedorRes.error) throw proveedorRes.error
  if (bodegaRes.error) throw bodegaRes.error
  if (productosExistentesRes.error) throw productosExistentesRes.error
  if (impuestosRes.error) throw impuestosRes.error
  if (barcodeRes.error) throw barcodeRes.error
  if (codeRes.error) throw codeRes.error
  if (duplicateDocRes.error) throw duplicateDocRes.error

  if (!proveedorRes.data) {
    throw new Error('Proveedor fuera de la empresa')
  }
  if (!bodegaRes.data) {
    throw new Error('Bodega fuera de la empresa')
  }
  if ((duplicateDocRes.data ?? []).some((item) => item.numero_externo?.trim().toLowerCase() === numeroExterno.toLowerCase())) {
    throw new Error(`Ya existe una factura de compra para ese proveedor con numero_externo ${numeroExterno}`)
  }

  const impuestos = (impuestosRes.data ?? []) as ImpuestoDisponible[]
  const existingProducts = new Map(
    ((productosExistentesRes.data ?? []) as ProductoBase[]).map((producto) => [producto.id, producto])
  )

  if (existingProducts.size !== existingProductIds.length) {
    throw new Error('Una o mas lineas apuntan a productos fuera de la empresa')
  }

  const barcodeOwners = new Map(
    ((barcodeRes.data ?? []) as Array<Pick<ProductoBase, 'id' | 'codigo' | 'codigo_barras'>>)
      .filter((item) => item.codigo_barras)
      .map((item) => [normalizeDigits(item.codigo_barras), item])
  )
  const codeOwners = new Map(
    ((codeRes.data ?? []) as Array<Pick<ProductoBase, 'id' | 'codigo'>>)
      .map((item) => [normalizeCode(item.codigo), item])
  )

  const createdProductIds: string[] = []
  const createdProductsByCode = new Map<string, ProductoBase>()
  const pendingProductUpdates: Array<{ id: string; patch: Partial<ProductoBase> }> = []
  const lineasCompra: Array<{
    producto_id: string
    descripcion: string
    cantidad: number
    precio_unitario: number
    descuento_porcentaje: number
    impuesto_id: string | null
  }> = []

  try {
    for (const linea of params.lineas) {
      const cantidad = linea.cantidad
      const precioUnitario = linea.precio_unitario
      const netCost = cantidad > 0 ? roundMoney(linea.subtotal_neto / cantidad) : precioUnitario
      const impuestoId = linea.impuesto_id
      const gtin = normalizeDigits(linea.gtin) || null

      if (linea.accion === 'usar_existente') {
        const producto = existingProducts.get(linea.producto_id!)
        if (!producto) {
          throw new Error(`Producto no encontrado para la linea "${linea.descripcion_original}"`)
        }

        const patch: Partial<ProductoBase> = {
          precio_compra: netCost,
          impuesto_id: impuestoId,
        }

        if (linea.persistir_gtin && gtin) {
          const owner = barcodeOwners.get(gtin)
          if (owner && owner.id !== producto.id) {
            throw new Error(`El GTIN ${gtin} ya pertenece al producto ${owner.codigo}`)
          }
          if (!normalizeDigits(producto.codigo_barras)) {
            patch.codigo_barras = gtin
          } else if (normalizeDigits(producto.codigo_barras) !== gtin) {
            throw new Error(`El producto ${producto.codigo} ya tiene un codigo de barras distinto al GTIN ${gtin}`)
          }
        }

        pendingProductUpdates.push({ id: producto.id, patch })
        lineasCompra.push({
          producto_id: producto.id,
          descripcion: linea.descripcion_importacion,
          cantidad,
          precio_unitario: precioUnitario,
          descuento_porcentaje: linea.descuento_porcentaje,
          impuesto_id: impuestoId,
        })
        continue
      }

      const nuevoCodigo = normalizeCode(linea.nuevo_codigo)
      if (!nuevoCodigo) {
        throw new Error(`La linea "${linea.descripcion_original}" requiere nuevo_codigo`)
      }
      const createdInRequest = createdProductsByCode.get(nuevoCodigo)
      if (!createdInRequest && codeOwners.has(nuevoCodigo)) {
        throw new Error(`Ya existe un producto con codigo ${nuevoCodigo}`)
      }

      if (linea.persistir_gtin && gtin) {
        const owner = barcodeOwners.get(gtin)
        if (owner && owner.id !== createdInRequest?.id) {
          throw new Error(`El GTIN ${gtin} ya pertenece al producto ${owner.codigo}`)
        }
      }

      if (createdInRequest) {
        if (linea.persistir_gtin && gtin && !normalizeDigits(createdInRequest.codigo_barras)) {
          const { error: updateCreatedError } = await admin
            .from('productos')
            .update({ codigo_barras: gtin, updated_at: new Date().toISOString() })
            .eq('empresa_id', empresaId)
            .eq('id', createdInRequest.id)

          if (updateCreatedError) throw updateCreatedError
          createdInRequest.codigo_barras = gtin
          barcodeOwners.set(gtin, {
            id: createdInRequest.id,
            codigo: createdInRequest.codigo,
            codigo_barras: gtin,
          })
        }

        lineasCompra.push({
          producto_id: createdInRequest.id,
          descripcion: linea.descripcion_importacion,
          cantidad,
          precio_unitario: precioUnitario,
          descuento_porcentaje: linea.descuento_porcentaje,
          impuesto_id: impuestoId,
        })
        continue
      }

      const { data: createdProduct, error: createError } = await admin
        .from('productos')
        .insert({
          empresa_id: empresaId,
          codigo: nuevoCodigo,
          codigo_barras: linea.persistir_gtin && gtin ? gtin : null,
          descripcion: buildProductDisplayDescription(nuevoCodigo, linea.nueva_descripcion ?? linea.descripcion_original),
          descripcion_larga: normalizeText(linea.descripcion_original),
          precio_venta: roundMoney(Number(linea.nuevo_precio_venta ?? 0)),
          precio_compra: netCost,
          precio_venta2: null,
          tiene_variantes: false,
          familia_id: null,
          fabricante_id: null,
          impuesto_id: impuestoId,
          cuenta_venta_id: null,
          cuenta_compra_id: null,
          cuenta_inventario_id: null,
          imagen_url: null,
          tiene_vencimiento: false,
          unidad_medida: 'UND',
          peso_gramos: null,
          activo: true,
        })
        .select('id, codigo, codigo_barras, descripcion, precio_compra, precio_venta, impuesto_id')
        .single()

      if (createError) throw createError

      createdProductIds.push(createdProduct.id)
      createdProductsByCode.set(nuevoCodigo, createdProduct)
      codeOwners.set(nuevoCodigo, { id: createdProduct.id, codigo: nuevoCodigo })
      if (createdProduct.codigo_barras) {
        barcodeOwners.set(normalizeDigits(createdProduct.codigo_barras), {
          id: createdProduct.id,
          codigo: createdProduct.codigo,
          codigo_barras: createdProduct.codigo_barras,
        })
      }

      lineasCompra.push({
        producto_id: createdProduct.id,
        descripcion: linea.descripcion_importacion,
        cantidad,
        precio_unitario: precioUnitario,
        descuento_porcentaje: linea.descuento_porcentaje,
        impuesto_id: impuestoId,
      })
    }

    const { data: documentoId, error: createDocError } = await supabase.rpc('secure_crear_factura_compra', {
      p_ejercicio_id: params.ejercicio.id,
      p_proveedor_id: params.proveedor_id,
      p_bodega_id: params.bodega_id,
      p_fecha: params.fecha_contabilizacion,
      p_numero_externo: numeroExterno,
      p_observaciones: buildObservaciones(params.observaciones, params.fecha_original, numeroExterno),
      p_lineas: lineasCompra,
    })

    if (createDocError) throw createDocError

    for (const update of pendingProductUpdates) {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      }
      if (update.patch.precio_compra != null) patch.precio_compra = update.patch.precio_compra
      if (update.patch.impuesto_id !== undefined) patch.impuesto_id = update.patch.impuesto_id
      if (update.patch.codigo_barras !== undefined) patch.codigo_barras = update.patch.codigo_barras

      const { error: updateError } = await admin
        .from('productos')
        .update(patch)
        .eq('empresa_id', empresaId)
        .eq('id', update.id)

      if (updateError) throw updateError
    }

    await postProcessImportedCompra({
      admin,
      documentoId: documentoId as string,
      lineas: params.lineas,
    })

    const createdProducts = await collectCreatedProductsSummary({
      admin,
      empresaId,
      lineas: params.lineas,
    })

    return {
      id: documentoId as string,
      createdProducts,
    }
  } catch (error) {
    if (createdProductIds.length) {
      await admin
        .from('productos')
        .delete()
        .eq('empresa_id', empresaId)
        .in('id', createdProductIds)
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (!puedeAcceder(session.rol, 'compras', 'manage')) {
      return NextResponse.json({ error: 'Sin permisos para importar compras' }, { status: 403 })
    }

    const body = await req.json()
    const {
      proveedor_id,
      bodega_id,
      fecha_contabilizacion,
      fecha_original,
      numero_externo,
      observaciones,
      lineas,
    }: {
      proveedor_id: string
      bodega_id: string
      fecha_contabilizacion: string
      fecha_original?: string
      numero_externo: string
      observaciones?: string
      lineas: LineaConfirmada[]
    } = body

    if (!proveedor_id) {
      return NextResponse.json({ error: 'proveedor_id requerido' }, { status: 400 })
    }
    if (!bodega_id) {
      return NextResponse.json({ error: 'bodega_id requerido' }, { status: 400 })
    }
    if (!numero_externo) {
      return NextResponse.json({ error: 'numero_externo requerido' }, { status: 400 })
    }
    if (!fecha_contabilizacion) {
      return NextResponse.json({ error: 'fecha_contabilizacion requerida' }, { status: 400 })
    }
    if (!lineas?.length) {
      return NextResponse.json({ error: 'Se requiere al menos una linea' }, { status: 400 })
    }

    const ejercicio = await getEjercicioActivo()
    if (!ejercicio) {
      return NextResponse.json({ error: 'Sin ejercicio contable activo' }, { status: 400 })
    }

    if (!isValidDateRange(fecha_contabilizacion, String(ejercicio.fecha_inicio), String(ejercicio.fecha_fin))) {
      return NextResponse.json({
        error: `La fecha ${fecha_contabilizacion} esta fuera del ejercicio activo (${ejercicio.fecha_inicio} a ${ejercicio.fecha_fin})`,
      }, { status: 400 })
    }

    for (const linea of lineas) {
      if (!(linea.codigo_pdf ?? '').trim()) {
        return NextResponse.json({ error: `La linea "${linea.descripcion}" no trae codigo PDF legible` }, { status: 400 })
      }
      if (linea.accion !== 'usar_existente' && linea.accion !== 'crear_nuevo') {
        return NextResponse.json({ error: 'Todas las lineas deben quedar resueltas antes de importar' }, { status: 400 })
      }
      if (linea.accion === 'usar_existente' && !linea.producto_id) {
        return NextResponse.json({ error: `La linea "${linea.descripcion}" requiere producto_id` }, { status: 400 })
      }
      if (linea.accion === 'crear_nuevo' && !(linea.nuevo_codigo ?? '').trim()) {
        return NextResponse.json({ error: `La linea "${linea.descripcion}" requiere nuevo_codigo` }, { status: 400 })
      }
    }

    const admin = createServiceClient()
    const { data: impuestos, error: impuestosError } = await admin
      .from('impuestos')
      .select('id, porcentaje')
      .eq('empresa_id', session.empresa_id)

    if (impuestosError) throw impuestosError

    const preparedLineas = await prepareLineasImportacion({
      admin,
      empresaId: session.empresa_id,
      impuestos: (impuestos ?? []) as ImpuestoDisponible[],
      lineas,
    })

    const fallbackResult = await confirmWithFallback({
      session,
      proveedor_id,
      bodega_id,
      fecha_contabilizacion,
      fecha_original,
      numero_externo,
      observaciones,
      lineas: preparedLineas,
      ejercicio,
    })

    revalidateInventoryDependentViews(session.empresa_id)
    return NextResponse.json({
      ok: true,
      id: fallbackResult.id,
      mode: 'server',
      created_products: fallbackResult.createdProducts,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al confirmar importacion' },
      { status: getErrorStatus(error) }
    )
  }
}
