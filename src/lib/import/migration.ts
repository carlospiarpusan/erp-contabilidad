export type ImportEntity =
  | 'clientes'
  | 'proveedores'
  | 'productos'
  | 'facturas-compra'
  | 'cuentas-puc'
  | 'asientos-contables'

export interface ImportColumn {
  campo: string
  label: string
  requerido: boolean
}

export const IMPORT_ENTITY_ORDER: readonly ImportEntity[] = [
  'clientes',
  'proveedores',
  'productos',
  'facturas-compra',
  'cuentas-puc',
  'asientos-contables',
] as const

export const IMPORT_ENTITY_META: Record<ImportEntity, {
  label: string
  shortLabel: string
  description: string
  validationHint: string
  apiPath: string
}> = {
  clientes: {
    label: 'Clientes',
    shortLabel: 'Clientes',
    description: 'Migracion de terceros comerciales con identificacion y contacto.',
    validationHint: 'Upsert por empresa_id + numero_documento.',
    apiPath: '/api/import/clientes',
  },
  proveedores: {
    label: 'Proveedores',
    shortLabel: 'Proveedores',
    description: 'Migracion del maestro de proveedores para compras y obligaciones.',
    validationHint: 'Upsert por empresa_id + numero_documento.',
    apiPath: '/api/import/proveedores',
  },
  productos: {
    label: 'Productos',
    shortLabel: 'Productos',
    description: 'Migracion de catalogo, impuestos, precios y stock inicial.',
    validationHint: 'Upsert por empresa_id + codigo. Si informas stock, usa la bodega principal.',
    apiPath: '/api/import/productos',
  },
  'facturas-compra': {
    label: 'Facturas de compra historicas',
    shortLabel: 'Facturas compra',
    description: 'Carga historica de compras sin mover inventario ni generar asiento automatico.',
    validationHint: 'El proveedor debe existir y la importacion es solo historica.',
    apiPath: '/api/import/facturas-compra',
  },
  'cuentas-puc': {
    label: 'PUC / cuentas contables',
    shortLabel: 'PUC',
    description: 'Migracion del plan de cuentas con naturaleza, nivel y cuenta padre.',
    validationHint: 'Recomendado importar de mayor a menor nivel para resolver cuentas padre.',
    apiPath: '/api/import/cuentas-puc',
  },
  'asientos-contables': {
    label: 'Asientos contables',
    shortLabel: 'Asientos',
    description: 'Migracion de saldos o comprobantes manuales agrupados por referencia.',
    validationHint: 'Cada referencia debe cuadrar debito = credito y usar codigos de cuenta existentes.',
    apiPath: '/api/import/asientos-contables',
  },
}

export const IMPORT_COLUMNS: Record<ImportEntity, ImportColumn[]> = {
  'facturas-compra': [
    { campo: 'nit_proveedor', label: 'NIT Proveedor', requerido: true },
    { campo: 'numero_externo', label: 'N Factura Proveedor', requerido: true },
    { campo: 'fecha', label: 'Fecha (YYYY-MM-DD)', requerido: true },
    { campo: 'total', label: 'Total', requerido: true },
    { campo: 'subtotal', label: 'Subtotal (sin IVA)', requerido: false },
    { campo: 'iva', label: 'IVA', requerido: false },
    { campo: 'descripcion', label: 'Descripcion', requerido: false },
    { campo: 'observaciones', label: 'Observaciones', requerido: false },
  ],
  clientes: [
    { campo: 'razon_social', label: 'Razon Social', requerido: true },
    { campo: 'numero_documento', label: 'NIT/CC', requerido: true },
    { campo: 'tipo_documento', label: 'Tipo Doc (NIT/CC/CE)', requerido: false },
    { campo: 'contacto', label: 'Contacto', requerido: false },
    { campo: 'email', label: 'Email', requerido: false },
    { campo: 'telefono', label: 'Telefono', requerido: false },
    { campo: 'whatsapp', label: 'WhatsApp', requerido: false },
    { campo: 'direccion', label: 'Direccion', requerido: false },
    { campo: 'ciudad', label: 'Ciudad', requerido: false },
    { campo: 'departamento', label: 'Departamento', requerido: false },
    { campo: 'activo', label: 'Activo (si/no)', requerido: false },
  ],
  proveedores: [
    { campo: 'razon_social', label: 'Razon Social', requerido: true },
    { campo: 'numero_documento', label: 'NIT/CC', requerido: true },
    { campo: 'tipo_documento', label: 'Tipo Doc (NIT/CC/CE)', requerido: false },
    { campo: 'contacto', label: 'Contacto', requerido: false },
    { campo: 'email', label: 'Email', requerido: false },
    { campo: 'telefono', label: 'Telefono', requerido: false },
    { campo: 'whatsapp', label: 'WhatsApp', requerido: false },
    { campo: 'ciudad', label: 'Ciudad', requerido: false },
    { campo: 'departamento', label: 'Departamento', requerido: false },
    { campo: 'direccion', label: 'Direccion', requerido: false },
    { campo: 'activo', label: 'Activo (si/no)', requerido: false },
  ],
  productos: [
    { campo: 'codigo', label: 'Codigo', requerido: true },
    { campo: 'descripcion', label: 'Descripcion', requerido: true },
    { campo: 'precio_venta', label: 'Precio Venta', requerido: true },
    { campo: 'precio_venta2', label: 'Precio Mayorista', requerido: false },
    { campo: 'precio_compra', label: 'Precio Compra', requerido: false },
    { campo: 'impuesto', label: 'IVA / Impuesto', requerido: false },
    { campo: 'codigo_barras', label: 'Codigo de barras', requerido: false },
    { campo: 'familia', label: 'Familia', requerido: false },
    { campo: 'stock_actual', label: 'Stock Inicial', requerido: false },
    { campo: 'stock_minimo', label: 'Stock Minimo', requerido: false },
    { campo: 'unidad_medida', label: 'Unidad', requerido: false },
    { campo: 'activo', label: 'Activo (si/no)', requerido: false },
  ],
  'cuentas-puc': [
    { campo: 'codigo', label: 'Codigo', requerido: true },
    { campo: 'descripcion', label: 'Descripcion', requerido: true },
    { campo: 'tipo', label: 'Tipo (activo/pasivo/patrimonio/ingreso/gasto/costo)', requerido: true },
    { campo: 'nivel', label: 'Nivel (1-5)', requerido: true },
    { campo: 'naturaleza', label: 'Naturaleza (debito/credito)', requerido: false },
    { campo: 'codigo_padre', label: 'Codigo cuenta padre', requerido: false },
    { campo: 'activa', label: 'Activa (si/no)', requerido: false },
  ],
  'asientos-contables': [
    { campo: 'referencia', label: 'Referencia del comprobante', requerido: true },
    { campo: 'fecha', label: 'Fecha (YYYY-MM-DD)', requerido: true },
    { campo: 'concepto', label: 'Concepto', requerido: true },
    { campo: 'codigo_cuenta', label: 'Codigo cuenta', requerido: true },
    { campo: 'descripcion_linea', label: 'Descripcion linea', requerido: false },
    { campo: 'debe', label: 'Debe', requerido: false },
    { campo: 'haber', label: 'Haber', requerido: false },
  ],
}

export const IMPORT_EXAMPLE_ROWS: Record<ImportEntity, string[]> = {
  'facturas-compra': ['900123456', 'FV-001', '2026-01-15', '119000', '100000', '19000', 'Mercancia general', ''],
  clientes: ['Juan Perez', '123456789', 'CC', 'Contacto principal', 'juan@email.com', '3001234567', '3001234567', 'Calle 1 #2-3', 'Pasto', 'Narino', 'si'],
  proveedores: ['Distribuciones SA', '900123456', 'NIT', 'Contacto Ventas', 'ventas@dist.com', '6021234567', '3001234567', 'Pasto', 'Narino', 'Av Principal 45', 'si'],
  productos: ['PROD001', 'Producto Ejemplo', '25000', '22000', '15000', '19%', '7701234567890', 'General', '100', '10', 'UND', 'si'],
  'cuentas-puc': ['110505', 'Caja general', 'activo', '4', 'debito', '1105', 'si'],
  'asientos-contables': ['SALDO-APERTURA-001', '2026-01-01', 'Saldos iniciales', '110505', 'Caja principal', '500000', '0'],
}

export function normalizeImportEntity(value?: string | null): ImportEntity {
  if (!value) return 'clientes'
  return IMPORT_ENTITY_ORDER.includes(value as ImportEntity) ? value as ImportEntity : 'clientes'
}

export function getImportEntityLabel(entity: ImportEntity) {
  return IMPORT_ENTITY_META[entity].label
}
