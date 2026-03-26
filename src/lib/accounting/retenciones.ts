export interface RetencionDefinition {
  id: string
  tipo: string
  nombre: string
  porcentaje: number
  base_minima?: number | null
  base_uvt?: number | null
  cuenta_contable_id?: string | null
  aplica_a?: string | null
  activa?: boolean
}

export interface RetencionSelection {
  retencion_id: string
  base_gravable?: number | null
  valor?: number | null
}

export interface RetencionResolved {
  retencion_id: string
  tipo: string
  nombre: string
  porcentaje: number
  base_gravable: number
  valor: number
  cuenta_contable_id?: string | null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function calcularRetencionesSeleccionadas(params: {
  selections?: RetencionSelection[] | null
  definitions: RetencionDefinition[]
  defaultBase: number
  uvtValue?: number | null
}) {
  const selections = params.selections ?? []
  const definitionsById = new Map(params.definitions.map((item) => [item.id, item]))
  const resolved: RetencionResolved[] = []

  for (const selection of selections) {
    const definition = definitionsById.get(selection.retencion_id)
    if (!definition) continue

    const baseGravable = round2(Number(selection.base_gravable ?? params.defaultBase ?? 0))
    if (!Number.isFinite(baseGravable) || baseGravable <= 0) continue

    const thresholdByPesos = Number(definition.base_minima ?? 0)
    const thresholdByUvt = definition.base_uvt && params.uvtValue
      ? Number(definition.base_uvt) * Number(params.uvtValue)
      : 0
    const threshold = Math.max(thresholdByPesos, thresholdByUvt)

    if (baseGravable < threshold) continue

    const valorCalculado = selection.valor != null
      ? round2(Number(selection.valor))
      : round2(baseGravable * Number(definition.porcentaje ?? 0) / 100)

    if (!Number.isFinite(valorCalculado) || valorCalculado <= 0) continue

    resolved.push({
      retencion_id: definition.id,
      tipo: definition.tipo,
      nombre: definition.nombre,
      porcentaje: Number(definition.porcentaje ?? 0),
      base_gravable: baseGravable,
      valor: valorCalculado,
      cuenta_contable_id: definition.cuenta_contable_id ?? null,
    })
  }

  return {
    items: resolved,
    total: round2(resolved.reduce((sum, item) => sum + item.valor, 0)),
  }
}
