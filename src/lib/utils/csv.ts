export type ParsedCSV = {
  headers: string[]
  rows: Record<string, string>[]
  delimiter: ',' | ';' | '\t'
}

export type CsvCell = string | number | boolean | null | undefined

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

export function createCsvResponse(params: {
  filename: string
  headers: string[]
  rows: AsyncIterable<CsvCell[]>
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
