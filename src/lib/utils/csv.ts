import { strToU8, zipSync } from 'fflate'

export type ParsedCSV = {
  headers: string[]
  rows: Record<string, string>[]
  delimiter: ',' | ';' | '\t'
}

export type CsvCell = string | number | boolean | null | undefined
export type ExportFormat = 'csv' | 'xlsx'

function detectDelimiter(headerLine: string): ',' | ';' | '\t' {
  const comma = (headerLine.match(/,/g) ?? []).length
  const semi = (headerLine.match(/;/g) ?? []).length
  const tab = (headerLine.match(/\t/g) ?? []).length
  if (tab >= comma && tab >= semi) return '\t'
  return semi > comma ? ';' : ','
}

function normalize(value: string) {
  return value.trim().replace(/\r$/, '')
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      result.push(normalize(current))
      current = ''
      continue
    }

    current += char
  }

  result.push(normalize(current))
  return result.map((v) => v.replace(/^"|"$/g, ''))
}

export function parseCSVText(input: string): ParsedCSV {
  const text = input.replace(/\uFEFF/g, '').trim()
  if (!text) return { headers: [], rows: [], delimiter: ',' }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return { headers: [], rows: [], delimiter: ',' }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCSVLine(lines[0], delimiter)
    .map((h) => h.toLowerCase())
    .map((h) => h.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  const rows = lines.slice(1).map((line) => {
    const values = splitCSVLine(line, delimiter)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] ?? ''
    })
    return row
  })

  return { headers, rows, delimiter }
}

function escapeCsvCell(value: CsvCell) {
  if (value === null || value === undefined) return ''

  const stringValue = String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function encodeCsvRow(values: CsvCell[]) {
  return `${values.map(escapeCsvCell).join(',')}\n`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnLabel(index: number) {
  let current = index + 1
  let label = ''

  while (current > 0) {
    const remainder = (current - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    current = Math.floor((current - 1) / 26)
  }

  return label
}

function sanitizeSheetName(value: string) {
  const cleaned = value
    .replace(/[\\/*?:[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return (cleaned || 'Exportacion').slice(0, 31)
}

function createWorksheetCell(value: CsvCell, rowIndex: number, columnIndex: number, isHeader: boolean) {
  const ref = `${columnLabel(columnIndex)}${rowIndex + 1}`
  const styleAttr = isHeader ? ' s="1"' : ''

  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"${styleAttr}/>`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"${styleAttr}><v>${value ? 1 : 0}</v></c>`
  }

  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

function buildWorksheetXml(headers: string[], rows: CsvCell[][]) {
  const allRows = [headers, ...rows]
  const rowXml = allRows.map((row, rowIndex) => (
    `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => createWorksheetCell(cell, rowIndex, columnIndex, rowIndex === 0)).join('')}</row>`
  )).join('')

  const lastColumn = columnLabel(Math.max(headers.length, 1) - 1)
  const lastRow = Math.max(allRows.length, 1)
  const autoFilterRef = `A1:${lastColumn}${lastRow}`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="${autoFilterRef}"/>
</worksheet>`
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
}

function buildWorkbookXml(sheetName: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function buildWorkbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function buildContentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
}

async function collectRows(rows: AsyncIterable<CsvCell[]> | Iterable<CsvCell[]>) {
  const collected: CsvCell[][] = []

  for await (const row of rows) {
    collected.push(row)
  }

  return collected
}

function createXlsxBuffer(params: { headers: string[]; rows: CsvCell[][]; sheetName: string }) {
  const sheetName = sanitizeSheetName(params.sheetName)
  const files = {
    '[Content_Types].xml': strToU8(buildContentTypesXml()),
    '_rels/.rels': strToU8(buildRootRelsXml()),
    'xl/workbook.xml': strToU8(buildWorkbookXml(sheetName)),
    'xl/_rels/workbook.xml.rels': strToU8(buildWorkbookRelsXml()),
    'xl/styles.xml': strToU8(buildStylesXml()),
    'xl/worksheets/sheet1.xml': strToU8(buildWorksheetXml(params.headers, params.rows)),
  }

  return zipSync(files, { level: 6 })
}

export function resolveExportFormat(input: string | null | undefined): ExportFormat {
  return String(input ?? '').toLowerCase() === 'xlsx' ? 'xlsx' : 'csv'
}

export function createCsvResponse(params: {
  filename: string
  headers: string[]
  rows: AsyncIterable<CsvCell[]> | Iterable<CsvCell[]>
}) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode('\uFEFF'))
      controller.enqueue(encoder.encode(encodeCsvRow(params.headers)))

      try {
        for await (const row of params.rows) {
          controller.enqueue(encoder.encode(encodeCsvRow(row)))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${params.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function createXlsxResponse(params: {
  filename: string
  headers: string[]
  rows: AsyncIterable<CsvCell[]> | Iterable<CsvCell[]>
  sheetName: string
}) {
  const rows = await collectRows(params.rows)
  const body = createXlsxBuffer({
    headers: params.headers,
    rows,
    sheetName: params.sheetName,
  })
  const stableBody = new Uint8Array(body)
  const blob = new Blob([stableBody], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return new Response(blob, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${params.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function createExportResponse(params: {
  format: ExportFormat
  baseFilename: string
  headers: string[]
  rows: AsyncIterable<CsvCell[]> | Iterable<CsvCell[]>
  sheetName: string
}) {
  if (params.format === 'xlsx') {
    return createXlsxResponse({
      filename: `${params.baseFilename}.xlsx`,
      headers: params.headers,
      rows: params.rows,
      sheetName: params.sheetName,
    })
  }

  return createCsvResponse({
    filename: `${params.baseFilename}.csv`,
    headers: params.headers,
    rows: params.rows,
  })
}
