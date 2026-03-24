import { canAccessModule, type AppModule, type AppRole } from '@/lib/auth/permissions'

export type ExportGroup = 'operativo' | 'contable' | 'maestro'
export type ExportFormat = 'csv' | 'xlsx'
export type ExportFieldType = 'date' | 'text'
export type ExportFieldDefault = 'today' | 'startOfYear' | 'empty'

export interface ExportField {
  name: string
  label: string
  type: ExportFieldType
  defaultValue?: ExportFieldDefault
  placeholder?: string
}

export interface ExportDefinition {
  id: string
  title: string
  description: string
  route: string
  module: AppModule
  group: ExportGroup
  formats: readonly ExportFormat[]
  fields?: readonly ExportField[]
}

export const EXPORT_GROUP_LABELS: Record<ExportGroup, string> = {
  operativo: 'Operativas',
  contable: 'Contables',
  maestro: 'Maestras',
}

export const EXPORT_REGISTRY: readonly ExportDefinition[] = [
  {
    id: 'ventas',
    title: 'Ventas',
    description: 'Facturas de venta con cliente, impuestos, descuentos y total.',
    route: '/api/export/ventas',
    module: 'informes',
    group: 'operativo',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'compras',
    title: 'Compras',
    description: 'Facturas de compra con proveedor, documento externo e impuestos.',
    route: '/api/export/compras',
    module: 'compras',
    group: 'operativo',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'inventario',
    title: 'Inventario',
    description: 'Catálogo valorizado con stock actual, stock mínimo y precios.',
    route: '/api/export/inventario',
    module: 'productos',
    group: 'operativo',
    formats: ['csv', 'xlsx'],
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Maestro de clientes con contacto, documento, ciudad y estado.',
    route: '/api/export/clientes',
    module: 'clientes',
    group: 'maestro',
    formats: ['csv', 'xlsx'],
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    description: 'Maestro de proveedores con contacto, documento, ciudad y estado.',
    route: '/api/export/proveedores',
    module: 'compras',
    group: 'maestro',
    formats: ['csv', 'xlsx'],
  },
  {
    id: 'pyg',
    title: 'Pérdidas y Ganancias',
    description: 'Estado de resultados con ingresos, costos, gastos y utilidad.',
    route: '/api/export/pyg',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'balance-situacion',
    title: 'Balance de Situación',
    description: 'Corte contable de activos, pasivos y patrimonio.',
    route: '/api/export/balance-situacion',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'fecha', label: 'Fecha de corte', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'sumas-saldos',
    title: 'Sumas y Saldos',
    description: 'Movimiento consolidado por cuenta con debe, haber y saldo.',
    route: '/api/export/sumas-saldos',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'libro-diario',
    title: 'Libro Diario',
    description: 'Detalle cronológico de asientos, cuentas, débitos y créditos.',
    route: '/api/export/libro-diario',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'libro-mayor',
    title: 'Libro Mayor',
    description: 'Movimientos y saldo acumulado por cuenta PUC.',
    route: '/api/export/libro-mayor',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'codigo_cuenta', label: 'Cuenta', type: 'text', placeholder: 'Ej: 110505' },
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'auxiliares',
    title: 'Auxiliares',
    description: 'Auxiliar contable por cuenta o prefijo de cuenta.',
    route: '/api/export/auxiliares',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'codigo_cuenta', label: 'Código cuenta', type: 'text', placeholder: 'Ej: 1105' },
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'retenciones-aplicadas',
    title: 'Retenciones aplicadas',
    description: 'Base, porcentaje y valor retenido por tercero y documento.',
    route: '/api/export/retenciones',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'faltantes-soporte',
    title: 'Faltantes de soporte',
    description: 'Compras que requieren documento soporte y aún no están validadas.',
    route: '/api/export/faltantes-soporte',
    module: 'compras',
    group: 'operativo',
    formats: ['csv', 'xlsx'],
  },
  {
    id: 'exogena',
    title: 'Paquete de Exógena',
    description: 'Consolidado exportable por vigencia con validaciones previas.',
    route: '/api/export/exogena',
    module: 'contabilidad',
    group: 'contable',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'año', label: 'Año', type: 'text', placeholder: '2026' },
    ],
  },
  {
    id: 'ventas-medio-pago',
    title: 'Ventas por Medio de Pago',
    description: 'Resumen por medio de pago con ticket promedio y última factura.',
    route: '/api/export/ventas-por-medio-pago',
    module: 'informes',
    group: 'operativo',
    formats: ['csv', 'xlsx'],
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
] as const

export function getVisibleExports(role: AppRole) {
  return EXPORT_REGISTRY.filter((entry) => canAccessModule(role, entry.module, 'read'))
}
