// ============================================================
// TIPOS DEL DOMINIO — ERP Contabilidad
// ============================================================

export type EstadoDocumento = 'pendiente' | 'pagada' | 'cancelada' | 'convertida'
export type TipoDocumento =
  | 'factura_venta'
  | 'factura_compra'
  | 'cotizacion'
  | 'pedido'
  | 'remision'
  | 'orden_compra'
  | 'gasto'
  | 'nota_credito'
  | 'nota_debito'

// ─── Maestros ────────────────────────────────────────────────

export interface Empresa {
  id: string
  nombre: string
  nit: string
  dv?: string
  direccion?: string
  ciudad?: string
  departamento?: string
  telefono?: string
  email?: string
  logo_url?: string
  regimen?: string
  created_at: string
}

export interface Ejercicio {
  id: string
  empresa_id: string
  año: number
  fecha_inicio: string
  fecha_fin: string
  estado: 'activo' | 'cerrado'
}

export interface Bodega {
  id: string
  empresa_id: string
  codigo: string
  nombre: string
  principal: boolean
}

export interface CuentaPUC {
  id: string
  empresa_id: string
  codigo: string
  descripcion: string
  tipo?: string
  nivel?: number
  cuenta_padre_id?: string
}

export interface Impuesto {
  id: string
  empresa_id: string
  codigo: string
  descripcion: string
  porcentaje: number
  subcuenta_compras_id?: string
  subcuenta_ventas_id?: string
}

export interface FormaPago {
  id: string
  empresa_id: string
  descripcion: string
  tipo?: string
  dias_vencimiento: number
  cuenta_id?: string
}

export interface Consecutivo {
  id: string
  empresa_id: string
  descripcion: string
  prefijo?: string
  consecutivo_actual: number
  tipo: string
}

export interface Familia {
  id: string
  empresa_id: string
  nombre: string
}

export interface Fabricante {
  id: string
  empresa_id: string
  nombre: string
}

export interface Transportadora {
  id: string
  empresa_id: string
  nombre: string
  whatsapp?: string
  url_rastreo?: string
  activa: boolean
}

// ─── Entidades Principales ───────────────────────────────────

export interface GrupoCliente {
  id: string
  empresa_id: string
  nombre: string
  descuento_porcentaje: number
}

export interface Cliente {
  id: string
  empresa_id: string
  razon_social: string
  nombre_contacto?: string
  tipo_documento: string
  numero_documento?: string
  dv?: string
  responsabilidad_fiscal?: string
  aplica_retencion: boolean
  grupo_id?: string
  grupo?: GrupoCliente
  email?: string
  telefono?: string
  whatsapp?: string
  direccion?: string
  ciudad?: string
  departamento?: string
  pais: string
  colaborador_id?: string
  observaciones?: string
  activo: boolean
  created_at: string
  updated_at?: string
}

export interface Proveedor {
  id: string
  empresa_id: string
  razon_social: string
  contacto?: string
  tipo_documento: string
  numero_documento?: string
  email?: string
  telefono?: string
  direccion?: string
  activo: boolean
}

export interface Acreedor {
  id: string
  empresa_id: string
  razon_social: string
  contacto?: string
  numero_documento?: string
  email?: string
  telefono?: string
  activo: boolean
}

export interface Colaborador {
  id: string
  empresa_id: string
  nombre: string
  email?: string
  telefono?: string
  porcentaje_comision: number
  activo: boolean
}

export interface Producto {
  id: string
  empresa_id: string
  codigo: string
  codigo_barras?: string
  descripcion: string
  descripcion_larga?: string
  precio_venta: number
  precio_compra: number
  precio_venta2?: number
  tiene_variantes?: boolean
  tiene_vencimiento?: boolean
  unidad_medida?: string
  familia_id?: string
  familia?: Familia
  fabricante_id?: string
  fabricante?: Fabricante
  impuesto_id?: string
  impuesto?: Impuesto
  imagen_url?: string
  activo: boolean
  stock?: Stock[]
  variantes?: ProductoVariante[]
  created_at?: string
  updated_at?: string
}

export interface ProductoVariante {
  id: string
  producto_id: string
  sku?: string
  codigo_barras?: string
  talla?: string
  color?: string
  precio_venta?: number
  precio_compra?: number
  imagen_url?: string
  activo: boolean
}

export interface Stock {
  id: string
  producto_id: string
  bodega_id: string
  bodega?: Bodega
  cantidad: number
  cantidad_minima: number
}

export interface TipoGasto {
  id: string
  empresa_id: string
  descripcion: string
  cuenta_id?: string
  valor_estimado: number
}

// ─── Documentos Transaccionales ──────────────────────────────

export interface DocumentoLinea {
  id: string
  documento_id: string
  producto_id?: string
  producto?: Producto
  descripcion?: string
  cantidad: number
  precio_unitario: number
  descuento_porcentaje: number
  impuesto_id?: string
  impuesto?: Impuesto
  subtotal: number
  total_iva: number
  total: number
  orden: number
}

export interface Documento {
  id: string
  empresa_id: string
  tipo: TipoDocumento
  numero: number
  serie_id?: string
  prefijo?: string
  numero_externo?: string
  cliente_id?: string
  cliente?: Cliente
  proveedor_id?: string
  proveedor?: Proveedor
  acreedor_id?: string
  colaborador_id?: string
  colaborador?: Colaborador
  bodega_id?: string
  bodega?: Bodega
  forma_pago_id?: string
  forma_pago?: FormaPago
  transportadora_id?: string
  ejercicio_id?: string
  documento_origen_id?: string
  fecha: string
  fecha_vencimiento?: string
  subtotal: number
  total_iva: number
  total_descuento: number
  total: number
  estado: EstadoDocumento
  email_enviado: boolean
  observaciones?: string
  lineas?: DocumentoLinea[]
  created_at: string
}

export interface Recibo {
  id: string
  empresa_id: string
  tipo: 'venta' | 'compra'
  documento_id: string
  documento?: Documento
  forma_pago_id?: string
  valor: number
  fecha: string
  observaciones?: string
}

// ─── Estadísticas (para el dashboard) ───────────────────────

export interface ResumenMes {
  mes: number
  año: number
  ventas: number
  compras: number
  costos: number
  gastos: number
  ganancias: number
}

export interface KPIs {
  facturas_activas: number
  total_facturado: number
  costos_ventas: number
  ganancias: number
  margen_porcentaje: number
}
