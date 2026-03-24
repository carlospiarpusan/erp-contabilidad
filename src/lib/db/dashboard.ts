import { createClient } from '@/lib/supabase/server'
import { getProductosSinRotacion, getStockBajo } from '@/lib/db/productos'

export interface DashboardKPIs {
  facturado_anio: number
  costos_anio: number
  ganancias_anio: number
  margen: number
  ventas_mes: number
  compras_mes: number
  gastos_mes: number
  cobrado_mes: number
  por_cobrar: number
  por_pagar: number
  facturas_pendientes: number
}

export interface DashboardResumenMes {
  mes: number
  ventas: number
  compras: number
  costos: number
  gastos: number
  ganancias: number
}

export interface DashboardAlertaStock {
  id: string
  codigo: string
  descripcion: string
  stock_actual: number
  stock_minimo: number
}

export interface DashboardAlertaSinRotacion {
  id: string
  codigo: string
  descripcion: string
  stock_actual: number
  dias_sin_venta: number | null
  valor_stock: number
}

export interface DashboardTopCliente {
  razon_social: string
  total: number
}

function mesActual() {
  const hoy = new Date()
  return {
    inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0],
    fin: hoy.toISOString().split('T')[0],
    anio: hoy.getFullYear(),
  }
}

function toNumber(value: unknown) {
  return Number(value ?? 0)
}

function shouldFallbackDashboardRpc(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message ?? '') : ''
  return code === '42883' || code === '42501' || message.includes('secure_get_')
}

async function getKPIsDashboardFallback(): Promise<DashboardKPIs> {
  const supabase = await createClient()
  const { inicio, fin, anio } = mesActual()

  const [ventas, compras, gastos, cobros] = await Promise.all([
    supabase.from('documentos').select('total, total_costo, estado, fecha')
      .eq('tipo', 'factura_venta').neq('estado', 'cancelada'),
    supabase.from('documentos').select('total, estado, fecha')
      .eq('tipo', 'factura_compra').neq('estado', 'cancelada'),
    supabase.from('documentos').select('total, fecha')
      .eq('tipo', 'gasto').neq('estado', 'cancelada'),
    supabase.from('recibos').select('valor, fecha').eq('tipo', 'venta'),
  ])

  if (ventas.error) throw ventas.error
  if (compras.error) throw compras.error
  if (gastos.error) throw gastos.error
  if (cobros.error) throw cobros.error

  const ventasRows = ventas.data ?? []
  const comprasRows = compras.data ?? []
  const gastosRows = gastos.data ?? []
  const cobrosRows = cobros.data ?? []

  const ventasAnio = ventasRows.filter((row) => row.fecha?.startsWith(String(anio)))
  const facturadoAnio = ventasAnio.reduce((sum, row) => sum + Number(row.total ?? 0), 0)
  const costosAnio = ventasAnio.reduce((sum, row) => sum + Number(row.total_costo ?? 0), 0)
  const gananciasAnio = facturadoAnio - costosAnio

  return {
    facturado_anio: facturadoAnio,
    costos_anio: costosAnio,
    ganancias_anio: gananciasAnio,
    margen: facturadoAnio > 0 ? Math.round((gananciasAnio / facturadoAnio) * 10000) / 100 : 0,
    ventas_mes: ventasRows.filter((row) => row.fecha >= inicio && row.fecha <= fin).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    compras_mes: comprasRows.filter((row) => row.fecha >= inicio && row.fecha <= fin).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    gastos_mes: gastosRows.filter((row) => row.fecha >= inicio && row.fecha <= fin).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    cobrado_mes: cobrosRows.filter((row) => row.fecha >= inicio && row.fecha <= fin).reduce((sum, row) => sum + Number(row.valor ?? 0), 0),
    por_cobrar: ventasRows.filter((row) => row.estado === 'pendiente').reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    por_pagar: comprasRows.filter((row) => row.estado === 'pendiente').reduce((sum, row) => sum + Number(row.total ?? 0), 0),
    facturas_pendientes: ventasRows.filter((row) => row.estado === 'pendiente').length,
  }
}

async function getResumenMensualFallback(anio?: number): Promise<DashboardResumenMes[]> {
  const supabase = await createClient()
  const currentYear = anio ?? new Date().getFullYear()
  const desde = `${currentYear}-01-01`
  const hasta = `${currentYear}-12-31`

  const [ventas, compras, gastos] = await Promise.all([
    supabase.from('documentos').select('fecha, total, total_costo').eq('tipo', 'factura_venta')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total').eq('tipo', 'factura_compra')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total').eq('tipo', 'gasto')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
  ])

  if (ventas.error) throw ventas.error
  if (compras.error) throw compras.error
  if (gastos.error) throw gastos.error

  return Array.from({ length: 12 }, (_, index) => {
    const mes = index + 1
    const prefix = `${currentYear}-${String(mes).padStart(2, '0')}`
    const sum = (rows: Array<{ fecha?: string | null; total?: number | null }>) =>
      rows.filter((row) => row.fecha?.startsWith(prefix)).reduce((acc, row) => acc + Number(row.total ?? 0), 0)
    const sumCostos = (rows: Array<{ fecha?: string | null; total_costo?: number | null }>) =>
      rows.filter((row) => row.fecha?.startsWith(prefix)).reduce((acc, row) => acc + Number(row.total_costo ?? 0), 0)

    const ventasMes = sum(ventas.data ?? [])
    const comprasMes = sum(compras.data ?? [])
    const costosMes = sumCostos(ventas.data ?? [])
    const gastosMes = sum(gastos.data ?? [])

    return {
      mes,
      ventas: ventasMes,
      compras: comprasMes,
      costos: costosMes,
      gastos: gastosMes,
      ganancias: ventasMes - costosMes - gastosMes,
    }
  })
}

async function getTopClientesFallback(limit = 5): Promise<DashboardTopCliente[]> {
  const supabase = await createClient()
  const { inicio } = mesActual()
  const { data, error } = await supabase
    .from('documentos')
    .select('total, cliente:cliente_id(id, razon_social)')
    .eq('tipo', 'factura_venta')
    .neq('estado', 'cancelada')
    .gte('fecha', inicio)

  if (error) throw error

  const grouped: Record<string, DashboardTopCliente> = {}
  for (const row of data ?? []) {
    const cliente = row.cliente as { id?: string; razon_social?: string } | null
    if (!cliente?.id) continue
    if (!grouped[cliente.id]) {
      grouped[cliente.id] = { razon_social: cliente.razon_social ?? '—', total: 0 }
    }
    grouped[cliente.id].total += toNumber(row.total)
  }

  return Object.values(grouped)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export async function getKPIsDashboard(): Promise<DashboardKPIs> {
  const supabase = await createClient()
  const { anio, fin } = mesActual()

  const [anualRes, mesRes] = await Promise.all([
    supabase.rpc('secure_get_kpis_dashboard', { p_anio: anio }),
    supabase.rpc('secure_get_dashboard_kpis_mes', { p_fecha: fin }),
  ])

  if (anualRes.error || mesRes.error) {
    const rpcError = anualRes.error ?? mesRes.error
    if (!shouldFallbackDashboardRpc(rpcError)) throw rpcError
    return getKPIsDashboardFallback()
  }

  const anual = (anualRes.data ?? {}) as Record<string, unknown>
  const mensual = (mesRes.data ?? {}) as Record<string, unknown>

  return {
    facturado_anio: toNumber(anual.total_facturado),
    costos_anio: toNumber(anual.costos_ventas),
    ganancias_anio: toNumber(anual.ganancias),
    margen: toNumber(anual.margen_porcentaje),
    ventas_mes: toNumber(mensual.ventas_mes),
    compras_mes: toNumber(mensual.compras_mes),
    gastos_mes: toNumber(mensual.gastos_mes),
    cobrado_mes: toNumber(mensual.cobrado_mes),
    por_cobrar: toNumber(mensual.por_cobrar),
    por_pagar: toNumber(mensual.por_pagar),
    facturas_pendientes: toNumber(mensual.facturas_pendientes),
  }
}

export async function getResumenMensual(anio?: number): Promise<DashboardResumenMes[]> {
  const supabase = await createClient()
  const currentYear = anio ?? new Date().getFullYear()
  const { data, error } = await supabase.rpc('secure_get_resumen_mensual', { p_anio: currentYear })

  if (error) {
    if (!shouldFallbackDashboardRpc(error)) throw error
    return getResumenMensualFallback(currentYear)
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    mes: Number(row.mes ?? 0),
    ventas: toNumber(row.ventas),
    compras: toNumber(row.compras),
    costos: toNumber(row.costos),
    gastos: toNumber(row.gastos),
    ganancias: toNumber(row.ganancias),
  }))
}

export async function getUltimasFacturas(limit = 6) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, total, estado, cliente:cliente_id(razon_social)')
    .eq('tipo', 'factura_venta')
    .neq('estado', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getUltimasCompras(limit = 5) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, total, estado, numero_externo, proveedor:proveedor_id(razon_social)')
    .eq('tipo', 'factura_compra')
    .neq('estado', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getAlertasStock(): Promise<DashboardAlertaStock[]> {
  const stockBajo = await getStockBajo()

  return stockBajo
    .slice(0, 50)
    .map((item) => ({
      id: item.producto_id ?? item.id,
      codigo: item.codigo,
      descripcion: item.descripcion,
      stock_actual: toNumber(item.cantidad),
      stock_minimo: toNumber(item.cantidad_minima),
    }))
}

export async function getAlertasSinRotacion(limit = 20): Promise<DashboardAlertaSinRotacion[]> {
  const items = await getProductosSinRotacion({ days: 90, limit })

  return items.map((item) => ({
    id: item.id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    stock_actual: item.stock_actual,
    dias_sin_venta: item.dias_sin_venta,
    valor_stock: item.valor_stock,
  }))
}

export async function getFacturasVencidas(limit = 5) {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, total, fecha_vencimiento, cliente:cliente_id(razon_social)')
    .eq('tipo', 'factura_venta')
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy)
    .order('fecha_vencimiento')
    .limit(limit)
  return data ?? []
}

export async function getTopClientes(limit = 5): Promise<DashboardTopCliente[]> {
  const supabase = await createClient()
  const { fin } = mesActual()
  const { data, error } = await supabase.rpc('secure_get_dashboard_top_clientes_mes', {
    p_limite: limit,
    p_fecha: fin,
  })

  if (error) {
    if (!shouldFallbackDashboardRpc(error)) throw error
    return getTopClientesFallback(limit)
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    razon_social: String(row.razon_social ?? '—'),
    total: toNumber(row.total),
  }))
}

export async function getKPIs() {
  const data = await getKPIsDashboard()
  return {
    facturas_activas: data.facturas_pendientes,
    total_facturado: data.facturado_anio,
    costos_ventas: data.costos_anio,
    ganancias: data.ganancias_anio,
    margen_porcentaje: data.margen,
  }
}
