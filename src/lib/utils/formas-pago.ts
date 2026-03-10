interface FormaPagoLike {
  descripcion?: string | null
  dias_vencimiento?: number | null
}

function normalizarDescripcion(descripcion?: string | null) {
  return (descripcion ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseFecha(fechaBase: string | Date) {
  if (fechaBase instanceof Date) {
    return {
      year: fechaBase.getUTCFullYear(),
      monthIndex: fechaBase.getUTCMonth(),
      day: fechaBase.getUTCDate(),
    }
  }

  const [yearRaw, monthRaw, dayRaw] = String(fechaBase).split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) {
    throw new Error('Fecha inválida')
  }

  return { year, monthIndex, day }
}

function toISODate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12)).toISOString().slice(0, 10)
}

export function isSistecreditoFormaPago(formaPago?: FormaPagoLike | null) {
  const descripcion = normalizarDescripcion(formaPago?.descripcion)
  return descripcion.includes('sistecredito')
}

export function calcularFechaPagoSistecredito(fechaBase: string | Date) {
  const { year, monthIndex } = parseFecha(fechaBase)
  return toISODate(year, monthIndex + 4, 15)
}

export function calcularFechaVencimientoFormaPago(
  formaPago: FormaPagoLike | null | undefined,
  fechaBase: string | Date
) {
  if (!formaPago) return ''
  if (isSistecreditoFormaPago(formaPago)) return calcularFechaPagoSistecredito(fechaBase)

  const dias = Math.max(0, Number(formaPago.dias_vencimiento ?? 0))
  if (dias <= 0) return ''

  const { year, monthIndex, day } = parseFecha(fechaBase)
  return toISODate(year, monthIndex, day + dias)
}
