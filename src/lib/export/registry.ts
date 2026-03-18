import { canAccessModule, type AppModule, type AppRole } from '@/lib/auth/permissions'

export type ExportGroup = 'operativo' | 'contable' | 'maestro'
export type ExportFormat = 'csv'
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
  format: ExportFormat
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
    format: 'csv',
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
    format: 'csv',
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
    format: 'csv',
  },
  {
    id: 'clientes',
    title: 'Clientes',
    description: 'Maestro de clientes con contacto, documento, ciudad y estado.',
    route: '/api/export/clientes',
    module: 'clientes',
    group: 'maestro',
    format: 'csv',
  },
  {
    id: 'proveedores',
    title: 'Proveedores',
    description: 'Maestro de proveedores con contacto, documento, ciudad y estado.',
    route: '/api/export/proveedores',
    module: 'compras',
    group: 'maestro',
    format: 'csv',
  },
  {
    id: 'pyg',
    title: 'Pérdidas y Ganancias',
    description: 'Estado de resultados con ingresos, costos, gastos y utilidad.',
    route: '/api/export/pyg',
    module: 'contabilidad',
    group: 'contable',
    format: 'csv',
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
    format: 'csv',
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
    format: 'csv',
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
  {
    id: 'ventas-medio-pago',
    title: 'Ventas por Medio de Pago',
    description: 'Resumen por medio de pago con ticket promedio y última factura.',
    route: '/api/export/ventas-por-medio-pago',
    module: 'informes',
    group: 'operativo',
    format: 'csv',
    fields: [
      { name: 'desde', label: 'Desde', type: 'date', defaultValue: 'startOfYear' },
      { name: 'hasta', label: 'Hasta', type: 'date', defaultValue: 'today' },
    ],
  },
] as const

export function getVisibleExports(role: AppRole) {
  return EXPORT_REGISTRY.filter((entry) => canAccessModule(role, entry.module, 'read'))
}
