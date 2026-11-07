export const EMPRESA_FACTURA_SELECT_FIELDS = [
  'id',
  'nombre',
  'nit',
  'dv',
  'razon_social',
  'direccion',
  'ciudad',
  'departamento',
  'telefono',
  'email',
  'regimen',
] as const

export const EMPRESA_FACTURA_SELECT = 'id, nombre, nit, dv, razon_social, direccion, ciudad, departamento, telefono, email, regimen'

export const EMPRESA_CONFIG_UPDATE_FIELDS = [
  'nombre',
  'nit',
  'dv',
  'razon_social',
  'direccion',
  'ciudad',
  'departamento',
  'pais',
  'telefono',
  'email',
  'regimen',
  'tipo_org',
  'plantilla_pdf',
] as const

export function buildColaboradorLookupTerms(params: {
  email?: string | null
  nombre?: string | null
}) {
  return {
    email: params.email?.trim() || null,
    nombre: params.nombre?.trim() || null,
  }
}

export function resolveFacturaColaboradorId(params: {
  rol: string
  requestedColaboradorId?: string | null
  matchedColaboradorId?: string | null
}) {
  if (params.rol === 'vendedor') {
    return params.matchedColaboradorId || null
  }

  return params.requestedColaboradorId || null
}
