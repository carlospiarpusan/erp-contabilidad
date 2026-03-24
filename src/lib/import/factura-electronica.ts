import { unzipSync } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

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

export type FacturaImportSuggestion = {
  producto_id: string
  codigo: string
  descripcion: string
  score: number
  reason: string
}

export type FacturaImportLinea = {
  descripcion: string
  codigo_pdf: string
  gtin: string | null
  standard_scheme_id: string | null
  standard_scheme_name: string | null
  cantidad: number
  precio_unitario: number
  precio_referencia: number | null
  subtotal: number
  subtotal_neto: number
  total_descuento: number
  descuento_porcentaje: number
  iva: number
  total: number
  porcentaje_iva: number
  producto_id: string | null
  producto_codigo: string | null
  producto_descripcion: string | null
  estado: 'encontrado' | 'no_encontrado' | 'sin_codigo'
  match_source: 'codigo_interno' | 'sin_match'
  sugerencias: FacturaImportSuggestion[]
  grupo_clave: string
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
  pdfPages: PdfPageLayout[] | null
  sourceType: 'xml' | 'zip' | 'pdf'
}

type PdfFacturaLinea = {
  descripcion: string
  codigo_pdf: string
  cantidad: number
  total: number
  precio_unitario_bruto: number
  descuento_unitario: number
  iva_unitario: number
  porcentaje_iva: number
}

type PdfTextItem = {
  str: string
  x: number
  y: number
  width: number
  height: number
}

type PdfTextRow = {
  y: number
  items: PdfTextItem[]
  text: string
}

type PdfPageLayout = {
  pageNumber: number
  rows: PdfTextRow[]
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

function sanitizeSuggestedCode(value: string | null | undefined) {
  return normalizeCode(value)
    .replace(/[^A-Z0-9/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

export function buildDescripcionConCodigo(codigo: string | null | undefined, descripcion: string | null | undefined) {
  const cleanCode = normalizeCode(codigo)
  const cleanDescription = (descripcion ?? '').trim().replace(/\s+/g, ' ')
  if (!cleanCode) return cleanDescription
  if (!cleanDescription) return cleanCode
  if (cleanDescription.startsWith(`${cleanCode} - `) || cleanDescription.startsWith(`${cleanCode} `)) {
    return cleanDescription
  }
  return `${cleanCode} - ${cleanDescription}`
}

export function buildSuggestedFacturaProductCode(params: {
  codigoPdf?: string | null
  codigoProveedor?: string | null
  gtin?: string | null
  descripcion?: string | null
  groupKey?: string | null
}) {
  const pdfCode = sanitizeSuggestedCode(params.codigoPdf)
  if (pdfCode) return pdfCode

  const supplierCode = sanitizeSuggestedCode(params.codigoProveedor)
  if (supplierCode) return supplierCode

  const gtin = normalizeDigits(params.gtin)
  if (gtin) return `GTIN-${gtin.slice(-14)}`

  const normalizedDescription = normalizeText(params.descripcion || params.groupKey || '')
  const base = normalizedDescription
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join('-')
    .slice(0, 28)

  const hashSource = normalizedDescription || 'PRODUCTO'
  let hashValue = 7
  for (const char of hashSource) {
    hashValue = (hashValue * 31 + char.charCodeAt(0)) >>> 0
  }
  const hash = hashValue.toString(36).toUpperCase().slice(-4).padStart(4, '0')

  return sanitizeSuggestedCode(`AUTO-${base || 'PRODUCTO'}-${hash}`)
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
  let loadingTask: { promise: Promise<{ numPages: number; getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<unknown> }> }>; destroy?: () => Promise<unknown> | unknown } | null = null
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      disableFontFace: true,
      stopAtErrors: false,
    })

    const pdf = await loadingTask.promise
    const pages: PdfPageLayout[] = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent() as {
        items?: Array<{
          str?: string
          transform?: number[]
          width?: number
          height?: number
        }>
      }

      const items = (textContent.items ?? [])
        .map((item) => {
          const value = (item.str ?? '').replace(/\s+/g, ' ').trim()
          const transform = Array.isArray(item.transform) ? item.transform : []
          return {
            str: value,
            x: Number(transform[4] ?? 0),
            y: Number(transform[5] ?? 0),
            width: Number(item.width ?? 0),
            height: Number(item.height ?? 0),
          } satisfies PdfTextItem
        })
        .filter((item) => item.str)

      const rows = buildPdfRows(items)
      pages.push({
        pageNumber,
        rows,
      })
    }

    const text = pages.flatMap((page) => page.rows.map((row) => row.text)).join('\n').trim()

    return {
      text: text || null,
      pages,
    }
  } catch (error) {
    console.error('Error leyendo PDF de factura electronica', error)
    return {
      text: null,
      pages: [],
    }
  } finally {
    if (loadingTask?.destroy) {
      await Promise.resolve(loadingTask.destroy()).catch(() => null)
    }
  }
}

function buildPdfRows(items: PdfTextItem[]) {
  const tolerance = 1.6
  const sortedItems = [...items].sort((left, right) => {
    if (Math.abs(left.y - right.y) > tolerance) return right.y - left.y
    return left.x - right.x
  })
  const rows: Array<{ y: number; items: PdfTextItem[] }> = []

  for (const item of sortedItems) {
    let targetRow: { y: number; items: PdfTextItem[] } | null = null
    let bestDistance = Number.POSITIVE_INFINITY

    for (const row of rows) {
      const distance = Math.abs(row.y - item.y)
      if (distance <= tolerance && distance < bestDistance) {
        targetRow = row
        bestDistance = distance
      }
    }

    if (!targetRow) {
      rows.push({ y: item.y, items: [item] })
      continue
    }

    targetRow.items.push(item)
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => ({
      y: row.y,
      items: row.items.sort((left, right) => left.x - right.x),
      text: row.items
        .map((item) => item.str.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' ')
        .trim(),
    }))
    .filter((row) => row.text)
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

function buildSuggestions(
  linea: Pick<FacturaImportLinea, 'codigo_pdf'>,
  productos: ProductoImportMatch[]
) {
  const normalizedCode = normalizeCodeKey(linea.codigo_pdf)

  if (!normalizedCode) return []

  return productos
    .flatMap((producto) => {
      const exactCode = normalizeCodeKey(producto.codigo) === normalizedCode
      if (!exactCode) return []

      return [{
        producto_id: producto.id,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        score: 1,
        reason: 'codigo PDF exacto',
      }]
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
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
    if (!pdfBuffer) {
      throw new Error('El ZIP debe incluir el PDF original para usar el codigo de cada articulo')
    }

    const pdfData = await extractPdfTextFromBuffer(pdfBuffer)
    if (!pdfData.text || !pdfData.pages.length) {
      throw new Error('No se pudo leer la columna Codigo del PDF adjunto en el ZIP')
    }

    return {
      rawXml,
      pdfText: pdfData.text,
      pdfPages: pdfData.pages,
      sourceType: 'zip',
    } satisfies FacturaElectronicaInput
  }

  if (filename.endsWith('.pdf') || fileType === 'application/pdf') {
    const pdfData = await extractPdfTextFromBuffer(buffer)
    if (!pdfData.text || !pdfData.pages.length) {
      throw new Error('No se pudo leer el contenido del PDF')
    }

    return {
      rawXml: null,
      pdfText: pdfData.text,
      pdfPages: pdfData.pages,
      sourceType: 'pdf',
    } satisfies FacturaElectronicaInput
  }

  return {
    rawXml: new TextDecoder('utf-8').decode(buffer),
    pdfText: null,
    pdfPages: null,
    sourceType: 'xml',
  } satisfies FacturaElectronicaInput
}

function parsePdfMoney(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function isPdfMoney(value: string) {
  return /^\d[\d,.]*\.\d{2}$/.test(value.trim())
}

function isPdfPercent(value: string) {
  return /^\d+(?:[.,]\d+)?\s*%$/.test(value.trim())
}

function isPdfQuantity(value: string) {
  return /^\d+(?:[.,]\d+)?$/.test(value.trim())
}

function isPdfCode(value: string) {
  return /^[A-Z0-9][A-Z0-9*/.-]*(?:\/[A-Z0-9*/.-]+)*$/i.test(normalizeCode(value))
}

function findClosestRowItem(params: {
  row: PdfTextRow
  targetX: number
  maxDistance: number
  predicate: (item: PdfTextItem) => boolean
}) {
  return params.row.items
    .filter((item) => params.predicate(item))
    .map((item) => ({
      item,
      distance: Math.abs(item.x - params.targetX),
    }))
    .filter((candidate) => candidate.distance <= params.maxDistance)
    .sort((left, right) => left.distance - right.distance)[0]?.item ?? null
}

function parseFacturaPdfLineasFromLayout(pages: PdfPageLayout[]) {
  const parsedLineas: PdfFacturaLinea[] = []

  for (const page of pages) {
    const headerRow = page.rows.find((row) => {
      const labels = row.items.map((item) => normalizeText(item.str))
      return labels.includes('CODIGO') && labels.includes('DESCRIPCION') && labels.includes('CANTIDAD')
    })

    if (!headerRow) continue

    const codeHeader = headerRow.items.find((item) => normalizeText(item.str) === 'CODIGO')
    const descriptionHeader = headerRow.items.find((item) => normalizeText(item.str) === 'DESCRIPCION')
    const quantityHeader = headerRow.items.find((item) => normalizeText(item.str) === 'CANTIDAD')
    const priceHeader = headerRow.items.find((item) => normalizeText(item.str) === 'PRECIO UNITARIO')
    const discountHeader = headerRow.items.find((item) => normalizeText(item.str) === 'DESCUENTO')
    const ivaHeader = headerRow.items.find((item) => normalizeText(item.str) === 'IVA')
    const totalHeader = headerRow.items.find((item) => normalizeText(item.str) === 'VALOR TOTAL')

    if (!codeHeader || !descriptionHeader || !quantityHeader || !priceHeader || !discountHeader || !ivaHeader || !totalHeader) {
      continue
    }

    for (const row of page.rows) {
      if (row.y >= headerRow.y - 2) continue

      const codeItem = findClosestRowItem({
        row,
        targetX: codeHeader.x,
        maxDistance: 60,
        predicate: (item) => isPdfCode(item.str),
      })
      const quantityItem = findClosestRowItem({
        row,
        targetX: quantityHeader.x,
        maxDistance: 55,
        predicate: (item) => isPdfQuantity(item.str),
      })
      const priceItem = findClosestRowItem({
        row,
        targetX: priceHeader.x,
        maxDistance: 85,
        predicate: (item) => isPdfMoney(item.str),
      })
      const discountItem = findClosestRowItem({
        row,
        targetX: discountHeader.x,
        maxDistance: 85,
        predicate: (item) => isPdfMoney(item.str),
      })
      const ivaAmountItem = findClosestRowItem({
        row,
        targetX: ivaHeader.x,
        maxDistance: 85,
        predicate: (item) => isPdfMoney(item.str),
      })
      const totalItem = findClosestRowItem({
        row,
        targetX: totalHeader.x,
        maxDistance: 85,
        predicate: (item) => isPdfMoney(item.str),
      })
      const ivaPercentItem = row.items.find((item) => isPdfPercent(item.str)) ?? null

      if (!codeItem || !quantityItem || !priceItem || !discountItem || !ivaAmountItem || !totalItem || !ivaPercentItem) {
        continue
      }

      const description = row.items
        .filter((item) => item.x >= descriptionHeader.x - 8 && item.x < quantityHeader.x - 8)
        .map((item) => item.str)
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (!description) continue

      parsedLineas.push({
        descripcion: description,
        codigo_pdf: normalizeCode(codeItem.str),
        cantidad: parsePdfMoney(quantityItem.str),
        total: roundNumber(parsePdfMoney(totalItem.str), 2),
        precio_unitario_bruto: roundNumber(parsePdfMoney(priceItem.str), 2),
        descuento_unitario: roundNumber(parsePdfMoney(discountItem.str), 2),
        iva_unitario: roundNumber(parsePdfMoney(ivaAmountItem.str), 2),
        porcentaje_iva: parsePdfMoney(ivaPercentItem.str.replace('%', '').trim()),
      })
    }
  }

  return parsedLineas
}

function parseFacturaPdfLineas(pdfText: string, pdfPages?: PdfPageLayout[] | null) {
  const layoutLineas = pdfPages ? parseFacturaPdfLineasFromLayout(pdfPages) : []
  if (layoutLineas.length > 0) return layoutLineas

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
        codigo_pdf: normalizeCode(match[4]),
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

  const subtotal = roundNumber(lineas.reduce((sum, linea) => sum + linea.subtotal_neto, 0), 2)
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
  pdfText: string | null | undefined,
  pdfPages?: PdfPageLayout[] | null
) {
  if (!pdfText) {
    throw new Error('Se requiere el PDF original para importar usando el codigo de cada articulo')
  }

  const pdfLineas = parseFacturaPdfLineas(pdfText, pdfPages)
  if (pdfLineas.length === 0) {
    throw new Error('El PDF no contiene una columna Codigo legible para las lineas de la factura')
  }
  if (pdfLineas.length !== lineas.length) {
    throw new Error('El PDF y el XML no coinciden en el numero de lineas de la factura')
  }

  const canMergeByIndex = pdfLineas.every((pdfLinea, index) => {
    const xmlLinea = lineas[index]
    return (
      Math.abs(pdfLinea.cantidad - xmlLinea.cantidad) < 0.001 &&
      Math.abs(pdfLinea.total - xmlLinea.total) <= 2
    )
  })

  if (!canMergeByIndex) {
    throw new Error('El PDF y el XML no se pudieron reconciliar linea por linea')
  }

  return lineas.map((linea, index) => {
    const pdfLinea = pdfLineas[index]

    return {
      ...linea,
      descripcion: linea.descripcion || pdfLinea.descripcion,
      codigo_pdf: pdfLinea.codigo_pdf,
      porcentaje_iva: linea.porcentaje_iva || pdfLinea.porcentaje_iva,
    }
  })
}

export function parseFacturaElectronica(
  rawInputXml: string,
  options?: { pdfText?: string | null; pdfPages?: PdfPageLayout[] | null }
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
    const standardNode = item?.StandardItemIdentification as Record<string, unknown> | undefined
    const standardIdNode = standardNode?.ID as Record<string, unknown> | string | undefined
    const quantity = toNumber(line.InvoicedQuantity as ParsedNode)
    const lineSubtotalNeto = toNumber(line.LineExtensionAmount as ParsedNode)
    const referencePrice = toNumber(((line.Price as Record<string, unknown> | undefined)?.PriceAmount) as ParsedNode)
    const allowanceCharges = asArray<Record<string, unknown>>(line.AllowanceCharge as Record<string, unknown> | undefined)
      .filter((charge) => nodeText((charge as Record<string, unknown>).ChargeIndicator as ParsedNode).toLowerCase() === 'false')
    const totalDescuento = roundNumber(
      allowanceCharges.reduce<number>((sum, charge) => sum + toNumber((charge as Record<string, unknown>).Amount as ParsedNode), 0),
      2
    )
    const lineSubtotal = roundNumber(
      toNumber((allowanceCharges[0] as Record<string, unknown> | undefined)?.BaseAmount as ParsedNode) ||
      (quantity > 0 && referencePrice > 0 ? quantity * referencePrice : lineSubtotalNeto + totalDescuento),
      2
    )
    const descuentoPorcentajeRaw = toNumber((allowanceCharges[0] as Record<string, unknown> | undefined)?.MultiplierFactorNumeric as ParsedNode)
    const descuentoPorcentaje = roundNumber(
      descuentoPorcentajeRaw || (lineSubtotal > 0 ? (totalDescuento * 100) / lineSubtotal : 0),
      2
    )
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
    const descripcion = pickText(item?.Description as ParsedNode, item?.Name as ParsedNode) || `Linea ${index + 1}`

    return {
      descripcion,
      codigo_pdf: '',
      gtin,
      standard_scheme_id: standardSchemeId,
      standard_scheme_name: standardSchemeName,
      cantidad: quantity || 1,
      precio_unitario: unitPrice || referencePrice || 0,
      precio_referencia: referencePrice || null,
      subtotal: roundNumber(lineSubtotal, 2),
      subtotal_neto: roundNumber(lineSubtotalNeto, 2),
      total_descuento: totalDescuento,
      descuento_porcentaje: descuentoPorcentaje,
      iva: lineIva,
      total: roundNumber(lineSubtotalNeto + lineIva, 2),
      porcentaje_iva: porcentajeIva,
      line_index: index,
    }
  })
  const enrichedLineas = enrichLineasWithPdf(rawLineas, options?.pdfText, options?.pdfPages)

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

export function parseFacturaElectronicaPdf(pdfText: string, pdfPages?: PdfPageLayout[] | null): FacturaImportParseResult {
  const pdfLineas = parseFacturaPdfLineas(pdfText, pdfPages)
  if (pdfLineas.length === 0) {
    throw new Error('El PDF no contiene lineas de factura reconocibles')
  }

  const lineas = pdfLineas.map((linea) => {
    const cantidad = linea.cantidad || 1
    const subtotal = roundNumber(linea.precio_unitario_bruto * cantidad, 2)
    const totalDescuento = roundNumber(linea.descuento_unitario * cantidad, 2)
    const subtotalNeto = roundNumber(subtotal - totalDescuento, 2)
    const iva = roundNumber(linea.iva_unitario * cantidad, 2)
    const total = roundNumber(linea.total, 2)
    const descuentoPorcentaje = subtotal > 0 ? roundNumber((totalDescuento * 100) / subtotal, 2) : 0

    return {
      descripcion: linea.descripcion,
      codigo_pdf: linea.codigo_pdf,
      gtin: null,
      standard_scheme_id: null,
      standard_scheme_name: null,
      cantidad,
      precio_unitario: linea.precio_unitario_bruto,
      precio_referencia: linea.precio_unitario_bruto || null,
      subtotal,
      subtotal_neto: subtotalNeto,
      total_descuento: totalDescuento,
      descuento_porcentaje: descuentoPorcentaje,
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
}) {
  const productosByCode = new Map(
    params.productos
      .filter((producto) => producto.codigo)
      .map((producto) => [normalizeCodeKey(producto.codigo), producto])
  )

  return params.lineas.map((linea) => {
    const normalizedPdfCode = normalizeCodeKey(linea.codigo_pdf)
    const producto = normalizedPdfCode
      ? productosByCode.get(normalizedPdfCode) ?? null
      : null
    let matchSource: FacturaImportLinea['match_source'] = 'sin_match'

    if (producto) {
      matchSource = 'codigo_interno'
    }

    const groupKey = linea.codigo_pdf
      ? `codigo:${normalizedPdfCode}`
      : `linea:${normalizeText(linea.descripcion) || 'SIN-REFERENCIA'}`
    const sugerencias = buildSuggestions(linea, params.productos)

    return {
      ...linea,
      producto_id: producto?.id ?? null,
      producto_codigo: producto?.codigo ?? null,
      producto_descripcion: producto?.descripcion ?? null,
      estado: producto ? 'encontrado' : (linea.codigo_pdf ? 'no_encontrado' : 'sin_codigo'),
      match_source: matchSource,
      sugerencias,
      grupo_clave: groupKey,
    }
  })
}

export function suggestPostingDate(fechaOriginal: string, ejercicio: { fecha_inicio: string; fecha_fin: string }) {
  if (!fechaOriginal) return ejercicio.fecha_inicio
  if (fechaOriginal < ejercicio.fecha_inicio) return ejercicio.fecha_inicio
  if (fechaOriginal > ejercicio.fecha_fin) return ejercicio.fecha_fin
  return fechaOriginal
}
