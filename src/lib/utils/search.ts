export function normalizeSearchTerm(value?: string | null) {
  return value?.trim() ?? ''
}

export function sanitizeSearchTerm(value?: string | null) {
  return normalizeSearchTerm(value).replace(/[%_(),]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseDocumentSearchTerm(value?: string | null) {
  const normalized = normalizeSearchTerm(value)
  const sanitized = sanitizeSearchTerm(value)
  const digits = normalized.replace(/\D/g, '')
  const prefix = normalized.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')

  return {
    normalized,
    sanitized,
    digits,
    prefix: prefix.trim(),
    numericValue: digits ? Number(digits) : null,
  }
}
