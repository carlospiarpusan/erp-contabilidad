function normalizeCode(value: string | null | undefined) {
  return (value ?? '').trim().toUpperCase()
}

function sanitizeSuggestedCode(value: string | null | undefined) {
  return normalizeCode(value)
    .replace(/[^A-Z0-9/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? '').replace(/[^0-9]/g, '')
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

  const legacySupplierCode = sanitizeSuggestedCode(params.codigoProveedor)
  if (legacySupplierCode) return legacySupplierCode

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
