import { unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'
import { PDFParse } from 'pdf-parse'

type ParsedNode = Record<string, unknown> | string | number | boolean | null | undefined

export type ProductoImportMatch = {
  id: string
  codigo: string
  codigo_barras: string | null
  descripcion: string
  precio_compra: number
  precio_venta: number
  impuesto_id: string | null
}

export type CodigoProveedorMatch = {
  producto_id: string
  codigo_proveedor: string | null
  gtin: string | null
}

export type FacturaImportSuggestion = {
  producto_id: string
  codigo: string
  descripcion: string
  score: number
  reason: string
}

export type FacturaImportLinea = {
  descripcion: string
  codigo: string
  codigo_proveedor: string
  gtin: string | null
  standard_scheme_id: string | null
  standard_scheme_name: string | null
  cantidad: number
  precio_unitario: number
  precio_referencia: number | null
  subtotal: number
  iva: number
  total: number
  porcentaje_iva: number
  producto_id: string | null
  producto_codigo: string | null
  producto_descripcion: string | null
  estado: 'encontrado' | 'no_encontrado' | 'sin_codigo'
  match_source: 'gtin_codigo_barras' | 'equivalencia_gtin' | 'equivalencia_codigo_proveedor' | 'codigo_interno' | 'sin_match'
  sugerencias: FacturaImportSuggestion[]
  grupo_clave: string
  codigo_proveedor_ambiguo: boolean
  equivalencia_permitida: boolean
}

export type FacturaImportLineaBase = Omit<
  FacturaImportLinea,
  | 'producto_id'
  | 'producto_codigo'
  | 'producto_descripcion'
  | 'estado'
  | 'match_source'
  | 'sugerencias'
  | 'grupo_clave'
  | 'codigo_proveedor_ambiguo'
  | 'equivalencia_permitida'
>

export type FacturaImportCabecera = {
  numero_externo: string
  fecha: string
  fecha_original: string
  nit_proveedor: string
  nombre_proveedor: string
  total: number
  subtotal: number
  iva: number
}

export type FacturaImportParseResult = {
  cabecera: FacturaImportCabecera
  lineas: FacturaImportLineaBase[]
  raw_xml: string
}

export type FacturaElectronicaInput = {
  rawXml: string | null
  pdfText: string | null
  sourceType: 'xml' | 'zip' | 'pdf'
}

type PdfFacturaLinea = {
  descripcion: string
  codigo_proveedor: string
  cantidad: number
  total: number
  precio_unitario_bruto: number
  descuento_unitario: number
  iva_unitario: number
  porcentaje_iva: number
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
  cdataPropName: '#cdata',
})

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
}

function nodeText(node: ParsedNode): string {
  if (node == null) return ''
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
    return String(node).trim()
  }
  if (typeof node !== 'object') return ''

  const record = node as Record<string, unknown>
  const direct = record['#text'] ?? record['#cdata']
  if (direct !== undefined) return nodeText(direct as ParsedNode)

  for (const value of Object.values(record)) {
    const text = nodeText(value as ParsedNode)
    if (text) return text
  }
  return ''
}

function pickText(...values: ParsedNode[]): string {
  for (const value of values) {
    const text = nodeText(value)
    if (text) return text
  }
  return ''
}

function normalizeCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function normalizeInvoiceNumber(value: string | null | undefined) {
  const normalized = normalizeCode(value).replace(/\s+/g, '')
  if (!normalized.includes('-')) return normalized

  const prefixedSequence = normalized.match(/^([A-Z]+[0-9]*?)-0*([0-9]+)$/)
  if (prefixedSequence) {
    return `${prefixedSequence[1]}${prefixedSequence[2]}`
  }

  return normalized.replace(/-/g, '')
}

function normalizeCodeKey(value: string | null | undefined) {
  return normalizeCode(value).replace(/[^A-Z0-9]+/g, '')
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
}

function normalizeTaxId(value: string | null | undefined) {
  const raw = (value ?? '').trim()
  const match = raw.match(/^([\d.]+)\s*-\s*\d+$/)
  if (match?.[1]) {
    return normalizeDigits(match[1])
  }
  return normalizeDigits(raw)
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function roundNumber(value: number, decimals = 6) {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function toNumber(value: ParsedNode) {
  const raw = nodeText(value).replace(/,/g, '')
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function extractFilesFromZip(buffer: Uint8Array) {
  const entries = unzipSync(buffer)
  const xmlEntryName = Object.keys(entries).find((name) => name.toLowerCase().endsWith('.xml'))
  if (!xmlEntryName) {
    throw new Error('El ZIP no contiene archivos XML')
  }

  const pdfEntryName = Object.keys(entries).find((name) => name.toLowerCase().endsWith('.pdf'))
  return {
    rawXml: new TextDecoder('utf-8').decode(entries[xmlEntryName]),
    pdfBuffer: pdfEntryName ? entries[pdfEntryName] : null,
  }
}

async function extractPdfTextFromBuffer(pdfBuffer: Uint8Array) {
  const parser = new PDFParse({ data: Buffer.from(pdfBuffer) })
  try {
    const result = await parser.getText()
    return result.text?.trim() || null
  } catch {
    return null
  } finally {
    await parser.destroy().catch(() => null)
  }
}

function extractInvoiceXml(rawXml: string) {
  const parsed = xmlParser.parse(rawXml) as Record<string, unknown>
  const attached = parsed.AttachedDocument as Record<string, unknown> | undefined
  if (!attached) return rawXml

  const attachment = attached.Attachment as Record<string, unknown> | undefined
  const externalReference = attachment?.ExternalReference as Record<string, unknown> | undefined
  const description = pickText(externalReference?.Description as ParsedNode)

  if (!description || !description.includes('<Invoice')) {
    throw new Error('No se encontro un Invoice embebido dentro del AttachedDocument')
  }

  return description.trim()
}

function getRootInvoice(xml: string) {
  const parsed = xmlParser.parse(xml) as Record<string, unknown>
  const invoice = parsed.Invoice as Record<string, unknown> | undefined
  if (!invoice) {
    throw new Error('El XML no corresponde a un Invoice UBL soportado')
  }
  return invoice
}

function scoreDescription(a: string, b: string) {
  const left = new Set(normalizeText(a).split(/\s+/).filter(Boolean))
  const right = new Set(normalizeText(b).split(/\s+/).filter(Boolean))
  if (left.size === 0 || right.size === 0) return 0

  let shared = 0
  for (const token of left) {
    if (right.has(token)) shared++
  }
  return (2 * shared) / (left.size + right.size)
}

function scorePrice(invoicePrice: number, productPrice: number) {
  if (!invoicePrice || !productPrice) return 0
  const delta = Math.abs(invoicePrice - productPrice)
  const base = Math.max(invoicePrice, productPrice)
  if (!base) return 0
  return Math.max(0, 1 - delta / base)
}

function buildSuggestions(
  linea: Pick<FacturaImportLinea, 'descripcion' | 'precio_unitario'>,
  productos: ProductoImportMatch[]
) {
  return productos
    .map((producto) => {
      const descScore = scoreDescription(linea.descripcion, producto.descripcion)
      const priceBase = producto.precio_compra > 0 ? producto.precio_compra : producto.precio_venta
      const priceScore = scorePrice(linea.precio_unitario, priceBase)
      const finalScore = roundNumber(descScore * 0.85 + priceScore * 0.15, 3)

      let reason = 'descripcion'
      if (descScore >= 0.9) reason = 'descripcion casi exacta'
      else if (priceScore >= 0.85 && descScore >= 0.55) reason = 'descripcion + precio'
      else if (priceScore >= 0.85) reason = 'precio similar'

      return {
        producto_id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        score: finalScore,
        reason,
      }
    })
    .filter((suggestion) => suggestion.score >= 0.35)
    .sort((a, b) => b.score - a.score || a.codigo.localeCompare(b.codigo))
    .slice(0, 5)
}

export async function readFacturaElectronicaInput(file: File) {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const filename = file.name.toLowerCase()
  const fileType = file.type.toLowerCase()

  if (
    filename.endsWith('.zip') ||
    fileType === 'application/zip' ||
    fileType === 'application/x-zip-compressed'
  ) {
    const { rawXml, pdfBuffer } = extractFilesFromZip(buffer)
    return {
      rawXml,
      pdfText: pdfBuffer ? await extractPdfTextFromBuffer(pdfBuffer) : null,
      sourceType: 'zip',
    } satisfies FacturaElectronicaInput
  }

  if (filename.endsWith('.pdf') || fileType === 'application/pdf') {
    const pdfText = await extractPdfTextFromBuffer(buffer)
    if (!pdfText) {
      throw new Error('No se pudo leer el contenido del PDF')
    }

    return {
      rawXml: null,
      pdfText,
      sourceType: 'pdf',
    } satisfies FacturaElectronicaInput
  }

  return {
    rawXml: new TextDecoder('utf-8').decode(buffer),
    pdfText: null,
    sourceType: 'xml',
  } satisfies FacturaElectronicaInput
}

function parsePdfMoney(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseFacturaPdfLineas(pdfText: string) {
  const lineRegex = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(\d[\d,.]*\.\d{2})\s+([A-Z0-9-]+)\s+(\d[\d,.]*\.\d{2})\s+(\d[\d,.]*\.\d{2})\s+(\d[\d,.]*\.\d{2})\s+(\d+(?:\.\d+)?)\s*%$/

  return pdfText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(lineRegex)
      if (!match) return []

      return [{
        descripcion: match[1].trim(),
        codigo_proveedor: normalizeCode(match[4]),
        cantidad: parsePdfMoney(match[2]),
        total: roundNumber(parsePdfMoney(match[3]), 2),
        precio_unitario_bruto: roundNumber(parsePdfMoney(match[5]), 2),
        descuento_unitario: roundNumber(parsePdfMoney(match[6]), 2),
        iva_unitario: roundNumber(parsePdfMoney(match[7]), 2),
        porcentaje_iva: parsePdfMoney(match[8]),
      } satisfies PdfFacturaLinea]
    })
}

function pdfDateToIso(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  return `${match[3]}-${match[2]}-${match[1]}`
}

function getPdfLines(pdfText: string) {
  return pdfText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, ' ').trim())
    .filter(Boolean)
}

function parseFacturaPdfCabecera(pdfText: string, lineas: FacturaImportLineaBase[]): FacturaImportCabecera {
  const lines = getPdfLines(pdfText)
  const numeroMatch = pdfText.match(/No\.\s*([A-Z0-9-]+)/i)
  const numeroExterno = normalizeInvoiceNumber(numeroMatch?.[1] ?? '')

  const invoiceLabelIndex = lines.findIndex((line) => /^FACTURA ELECTRONICA DE VENTA$/i.test(line))
  let fechaOriginal = ''
  if (invoiceLabelIndex >= 0) {
    for (const line of lines.slice(invoiceLabelIndex + 1, invoiceLabelIndex + 6)) {
      const candidate = pdfDateToIso(line)
      if (candidate) {
        fechaOriginal = candidate
        break
      }
    }
  }
  if (!fechaOriginal) {
    const dianDate = pdfText.match(/(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}-\d{2}:\d{2}\s+FECHA DIAN:/)
    fechaOriginal = dianDate?.[1] ?? new Date().toISOString().slice(0, 10)
  }

  let nombreProveedor = ''
  for (let index = 0; index < lines.length - 1; index++) {
    if (!/^Tel:/i.test(lines[index])) continue
    const candidate = lines[index + 1]
    if (
      candidate &&
      !/^(Cantidad|Codigo|Nombre:|Direccion:|Ciudad:|Telefono:|Cliente Fecha:|Fecha Vencimiento:|CC\/NIT|Notas|FACTURA ELECTRONICA DE VENTA|Medio de Pago:|Forma de Pago:|Vendedor:|N° Pedido:|Totales)$/i.test(candidate)
    ) {
      nombreProveedor = candidate
      break
    }
  }
  if (!nombreProveedor) {
    nombreProveedor = lines.find((line) => /\b(S\.A\.S|SAS|LTDA|S\.A)\b/i.test(line)) ?? ''
  }

  let nitProveedor = ''
  const nitNearInvoice = pdfText.match(/No\.\s*[A-Z0-9-]+\s*\n([0-9.\-]+)/i)
  if (nitNearInvoice?.[1]) {
    nitProveedor = normalizeTaxId(nitNearInvoice[1])
  }

  const invoiceNoIndex = lines.findIndex((line) => /^No\./i.test(line))
  if (!nitProveedor && invoiceNoIndex >= 0) {
    for (const line of lines.slice(invoiceNoIndex + 1, invoiceNoIndex + 8)) {
      const digits = normalizeDigits(line)
      if (digits.length >= 8 && digits.length <= 15) {
        nitProveedor = normalizeTaxId(line)
        break
      }
    }
  }

  const subtotal = roundNumber(lineas.reduce((sum, linea) => sum + linea.subtotal, 0), 2)
  const iva = roundNumber(lineas.reduce((sum, linea) => sum + linea.iva, 0), 2)
  const total = roundNumber(lineas.reduce((sum, linea) => sum + linea.total, 0), 2)

  if (!numeroExterno) {
    throw new Error('No se pudo identificar el numero de la factura en el PDF')
  }

  return {
    numero_externo: numeroExterno,
    fecha: fechaOriginal,
    fecha_original: fechaOriginal,
    nit_proveedor: nitProveedor,
    nombre_proveedor: nombreProveedor,
    total,
    subtotal,
    iva,
  }
}

function enrichLineasWithPdf(
  lineas: Array<FacturaImportLineaBase & { line_index: number }>,
  pdfText: string | null | undefined
) {
  if (!pdfText) return lineas

  const pdfLineas = parseFacturaPdfLineas(pdfText)
  if (pdfLineas.length !== lineas.length) return lineas

  const canMergeByIndex = pdfLineas.every((pdfLinea, index) => {
    const xmlLinea = lineas[index]
    return (
      Math.abs(pdfLinea.cantidad - xmlLinea.cantidad) < 0.001 &&
      Math.abs(pdfLinea.total - xmlLinea.total) <= 2
    )
  })

  if (!canMergeByIndex) return lineas

  return lineas.map((linea, index) => {
    const pdfLinea = pdfLineas[index]
    const codigoProveedor = pdfLinea.codigo_proveedor || linea.codigo_proveedor

    return {
      ...linea,
      descripcion: linea.descripcion || pdfLinea.descripcion,
      codigo: codigoProveedor || linea.codigo || linea.gtin || '',
      codigo_proveedor: codigoProveedor,
      porcentaje_iva: linea.porcentaje_iva || pdfLinea.porcentaje_iva,
    }
  })
}

export function parseFacturaElectronica(
  rawInputXml: string,
  options?: { pdfText?: string | null }
): FacturaImportParseResult {
  const invoiceXml = extractInvoiceXml(rawInputXml)
  const invoice = getRootInvoice(invoiceXml) as Record<string, unknown>
  const supplierParty = invoice.AccountingSupplierParty as Record<string, unknown> | undefined
  const supplier = supplierParty?.Party as Record<string, unknown> | undefined
  const supplierTax = supplier?.PartyTaxScheme as Record<string, unknown> | undefined
  const supplierLegal = supplier?.PartyLegalEntity as Record<string, unknown> | undefined
  const totals = invoice.LegalMonetaryTotal as Record<string, unknown> | undefined
  const taxTotals = asArray<Record<string, unknown>>(invoice.TaxTotal as Record<string, unknown> | undefined)

  const numeroExterno = normalizeInvoiceNumber(pickText(invoice.ID as ParsedNode, invoice.InvoiceID as ParsedNode))
  const fechaOriginal = pickText(invoice.IssueDate as ParsedNode)
  const subtotal = toNumber((totals?.LineExtensionAmount ?? totals?.TaxExclusiveAmount) as ParsedNode)
  const total = toNumber((totals?.PayableAmount ?? totals?.TaxInclusiveAmount) as ParsedNode)
  const iva = roundNumber(
    taxTotals.reduce<number>((sum, taxTotal) => sum + toNumber(taxTotal.TaxAmount as ParsedNode), 0),
    2
  )

  const rawLineas = asArray<Record<string, unknown>>(invoice.InvoiceLine as Record<string, unknown> | undefined).map((linea, index) => {
    const line = linea as Record<string, unknown>
    const item = line.Item as Record<string, unknown> | undefined
    const sellerNode = item?.SellersItemIdentification as Record<string, unknown> | undefined
    const standardNode = item?.StandardItemIdentification as Record<string, unknown> | undefined
    const standardIdNode = standardNode?.ID as Record<string, unknown> | string | undefined
    const quantity = toNumber(line.InvoicedQuantity as ParsedNode)
    const lineSubtotal = toNumber(line.LineExtensionAmount as ParsedNode)
    const referencePrice = toNumber(((line.Price as Record<string, unknown> | undefined)?.PriceAmount) as ParsedNode)
    const unitPrice = quantity > 0 && lineSubtotal > 0
      ? roundNumber(lineSubtotal / quantity)
      : roundNumber(referencePrice)
    const lineTaxTotal = asArray<Record<string, unknown>>(line.TaxTotal as Record<string, unknown> | undefined)
    const lineIva = roundNumber(
      lineTaxTotal.reduce<number>((sum, taxTotal) => sum + toNumber(taxTotal.TaxAmount as ParsedNode), 0),
      2
    )
    const firstTaxSubtotal = asArray(
      (lineTaxTotal[0] as Record<string, unknown> | undefined)?.TaxSubtotal as Record<string, unknown> | undefined
    )[0] as Record<string, unknown> | undefined
    const porcentajeIva = toNumber(((firstTaxSubtotal?.TaxCategory as Record<string, unknown> | undefined)?.Percent) as ParsedNode)
    const standardText = nodeText(standardIdNode as ParsedNode)
    const standardSchemeId = typeof standardIdNode === 'object' && standardIdNode
      ? nodeText((standardIdNode as Record<string, unknown>)['@_schemeID'] as ParsedNode) || null
      : null
    const standardSchemeName = typeof standardIdNode === 'object' && standardIdNode
      ? nodeText((standardIdNode as Record<string, unknown>)['@_schemeName'] as ParsedNode) || null
      : null
    const gtin = standardSchemeId === '010' ? normalizeDigits(standardText) || null : null
    const codigoProveedor = normalizeCode(nodeText(sellerNode?.ID as ParsedNode))
    const descripcion = pickText(item?.Description as ParsedNode, item?.Name as ParsedNode) || `Linea ${index + 1}`

    return {
      descripcion,
      codigo: codigoProveedor || gtin || '',
      codigo_proveedor: codigoProveedor,
      gtin,
      standard_scheme_id: standardSchemeId,
      standard_scheme_name: standardSchemeName,
      cantidad: quantity || 1,
      precio_unitario: unitPrice || referencePrice || 0,
      precio_referencia: referencePrice || null,
      subtotal: roundNumber(lineSubtotal, 2),
      iva: lineIva,
      total: roundNumber(lineSubtotal + lineIva, 2),
      porcentaje_iva: porcentajeIva,
      line_index: index,
    }
  })
  const enrichedLineas = enrichLineasWithPdf(rawLineas, options?.pdfText)

  return {
    cabecera: {
      numero_externo: numeroExterno,
      fecha: fechaOriginal || new Date().toISOString().slice(0, 10),
      fecha_original: fechaOriginal || new Date().toISOString().slice(0, 10),
      nit_proveedor: normalizeDigits(pickText(supplierTax?.CompanyID as ParsedNode, supplier?.PartyIdentification as ParsedNode)),
      nombre_proveedor: pickText(
        supplierLegal?.RegistrationName as ParsedNode,
        supplier?.PartyName as ParsedNode,
        supplier?.RegistrationName as ParsedNode
      ),
      total,
      subtotal,
      iva,
    },
    lineas: enrichedLineas,
    raw_xml: invoiceXml,
  }
}

export function parseFacturaElectronicaPdf(pdfText: string): FacturaImportParseResult {
  const pdfLineas = parseFacturaPdfLineas(pdfText)
  if (pdfLineas.length === 0) {
    throw new Error('El PDF no contiene lineas de factura reconocibles')
  }

  const lineas = pdfLineas.map((linea) => {
    const cantidad = linea.cantidad || 1
    const subtotal = roundNumber((linea.precio_unitario_bruto - linea.descuento_unitario) * cantidad, 2)
    const iva = roundNumber(linea.iva_unitario * cantidad, 2)
    const total = roundNumber(linea.total, 2)
    const precioUnitario = cantidad > 0 ? roundNumber(subtotal / cantidad) : 0

    return {
      descripcion: linea.descripcion,
      codigo: linea.codigo_proveedor,
      codigo_proveedor: linea.codigo_proveedor,
      gtin: null,
      standard_scheme_id: null,
      standard_scheme_name: null,
      cantidad,
      precio_unitario: precioUnitario,
      precio_referencia: linea.precio_unitario_bruto || null,
      subtotal,
      iva,
      total,
      porcentaje_iva: linea.porcentaje_iva,
    } satisfies FacturaImportLineaBase
  })

  return {
    cabecera: parseFacturaPdfCabecera(pdfText, lineas),
    lineas,
    raw_xml: '',
  }
}

export function buildFacturaImportMatches(params: {
  lineas: FacturaImportLineaBase[]
  productos: ProductoImportMatch[]
  proveedorId: string | null
  equivalencias: CodigoProveedorMatch[]
}) {
  const productosById = new Map(params.productos.map((producto) => [producto.id, producto]))
  const productosByCode = new Map(
    params.productos
      .filter((producto) => producto.codigo)
      .map((producto) => [normalizeCodeKey(producto.codigo), producto])
  )
  const productosByBarcode = new Map(
    params.productos
      .filter((producto) => producto.codigo_barras)
      .map((producto) => [normalizeDigits(producto.codigo_barras), producto])
  )

  const equivalenciaByGtin = new Map<string, CodigoProveedorMatch>()
  const equivalenciaByCodigo = new Map<string, CodigoProveedorMatch>()
  if (params.proveedorId) {
    for (const equivalencia of params.equivalencias) {
      if (equivalencia.gtin) {
        equivalenciaByGtin.set(normalizeDigits(equivalencia.gtin), equivalencia)
      } else if (equivalencia.codigo_proveedor) {
        equivalenciaByCodigo.set(normalizeCodeKey(equivalencia.codigo_proveedor), equivalencia)
      }
    }
  }

  const duplicateCounts = new Map<string, number>()
  for (const linea of params.lineas) {
    if (linea.gtin) continue
    if (!linea.codigo_proveedor) continue
    const key = normalizeCodeKey(linea.codigo_proveedor)
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
  }

  return params.lineas.map((linea) => {
    let producto = linea.gtin ? productosByBarcode.get(normalizeDigits(linea.gtin)) ?? null : null
    let matchSource: FacturaImportLinea['match_source'] = 'sin_match'

    if (producto) {
      matchSource = 'gtin_codigo_barras'
    } else if (linea.gtin) {
      const equivalencia = equivalenciaByGtin.get(normalizeDigits(linea.gtin))
      producto = equivalencia ? productosById.get(equivalencia.producto_id) ?? null : null
      if (producto) matchSource = 'equivalencia_gtin'
    }

    if (!producto && linea.codigo_proveedor) {
      const equivalencia = equivalenciaByCodigo.get(normalizeCodeKey(linea.codigo_proveedor))
      producto = equivalencia ? productosById.get(equivalencia.producto_id) ?? null : null
      if (producto) matchSource = 'equivalencia_codigo_proveedor'
    }

    if (!producto && linea.codigo_proveedor) {
      producto = productosByCode.get(normalizeCodeKey(linea.codigo_proveedor)) ?? null
      if (producto) matchSource = 'codigo_interno'
    }

    const codigoProveedorAmbiguo = !linea.gtin && !!linea.codigo_proveedor && (duplicateCounts.get(normalizeCodeKey(linea.codigo_proveedor)) ?? 0) > 1
    const groupKey = linea.gtin
      ? `gtin:${normalizeDigits(linea.gtin)}`
      : linea.codigo_proveedor
        ? `codigo:${normalizeCodeKey(linea.codigo_proveedor)}`
        : `linea:${normalizeText(linea.descripcion) || 'SIN-REFERENCIA'}`
    const sugerencias = buildSuggestions(linea, params.productos)

    return {
      ...linea,
      producto_id: producto?.id ?? null,
      producto_codigo: producto?.codigo ?? null,
      producto_descripcion: producto?.descripcion ?? null,
      estado: producto ? 'encontrado' : (linea.codigo || linea.gtin ? 'no_encontrado' : 'sin_codigo'),
      match_source: matchSource,
      sugerencias,
      grupo_clave: groupKey,
      codigo_proveedor_ambiguo: codigoProveedorAmbiguo,
      equivalencia_permitida: !!linea.gtin || (!!linea.codigo_proveedor && !codigoProveedorAmbiguo),
    }
  })
}

export function suggestPostingDate(fechaOriginal: string, ejercicio: { fecha_inicio: string; fecha_fin: string }) {
  if (!fechaOriginal) return ejercicio.fecha_inicio
  if (fechaOriginal < ejercicio.fecha_inicio) return ejercicio.fecha_inicio
  if (fechaOriginal > ejercicio.fecha_fin) return ejercicio.fecha_fin
  return fechaOriginal
}
