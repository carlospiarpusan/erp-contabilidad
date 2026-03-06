import { createClient } from '@/lib/supabase/server'
import { hasLowStock } from '@/lib/utils/stock'

// ── helpers ───────────────────────────────────────────────────────────────────

function mesActual() {
  const hoy = new Date()
  return {
    inicio: new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0],
    fin:    hoy.toISOString().split('T')[0],
    anio:   hoy.getFullYear(),
  }
}

// ── KPIs principales ─────────────────────────────────────────────────────────

export async function getKPIsDashboard() {
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

  const vRows = ventas.data ?? []
  const cRows = compras.data ?? []
  const gRows = gastos.data ?? []
  const rRows = cobros.data ?? []

  const vAnio  = vRows.filter(r => r.fecha?.startsWith(String(anio)))
  const facturadoAnio = vAnio.reduce((s, r) => s + (r.total ?? 0), 0)
  const costosAnio    = vAnio.reduce((s, r) => s + (r.total_costo ?? 0), 0)
  const gananciasAnio = facturadoAnio - costosAnio
  const margen        = facturadoAnio > 0 ? Math.round((gananciasAnio / facturadoAnio) * 10000) / 100 : 0

  const vMes = vRows.filter(r => r.fecha >= inicio && r.fecha <= fin)
  const cMes = cRows.filter(r => r.fecha >= inicio && r.fecha <= fin)
  const gMes = gRows.filter(r => r.fecha >= inicio && r.fecha <= fin)

  return {
    facturado_anio:      facturadoAnio,
    costos_anio:         costosAnio,
    ganancias_anio:      gananciasAnio,
    margen,
    ventas_mes:          vMes.reduce((s, r) => s + (r.total ?? 0), 0),
    compras_mes:         cMes.reduce((s, r) => s + (r.total ?? 0), 0),
    gastos_mes:          gMes.reduce((s, r) => s + (r.total ?? 0), 0),
    cobrado_mes:         rRows.filter(r => r.fecha >= inicio && r.fecha <= fin).reduce((s, r) => s + (r.valor ?? 0), 0),
    por_cobrar:          vRows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0),
    por_pagar:           cRows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0),
    facturas_pendientes: vRows.filter(r => r.estado === 'pendiente').length,
  }
}

// ── Resumen mensual ───────────────────────────────────────────────────────────

export async function getResumenMensual(anio?: number) {
  const supabase = await createClient()
  const año = anio ?? new Date().getFullYear()
  const desde = `${año}-01-01`
  const hasta = `${año}-12-31`

  const [ventas, compras, gastos] = await Promise.all([
    supabase.from('documentos').select('fecha, total').eq('tipo', 'factura_venta')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total').eq('tipo', 'factura_compra')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total').eq('tipo', 'gasto')
      .neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
  ])

  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const pad = String(mes).padStart(2, '0')
    const p   = `${año}-${pad}`
    const sum = (rows: { fecha?: string | null; total?: number | null }[]) =>
      rows.filter(r => r.fecha?.startsWith(p)).reduce((s, r) => s + (r.total ?? 0), 0)
    return {
      mes,
      ventas:  sum(ventas.data  ?? []),
      compras: sum(compras.data ?? []),
      gastos:  sum(gastos.data  ?? []),
    }
  })
}

// ── Últimas facturas venta ────────────────────────────────────────────────────

export async function getUltimasFacturas(limit = 6) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, total, estado, cliente:cliente_id(razon_social)')
    .eq('tipo', 'factura_venta').neq('estado', 'cancelada')
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ── Últimas compras ───────────────────────────────────────────────────────────

export async function getUltimasCompras(limit = 5) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, total, estado, numero_externo, proveedor:proveedor_id(razon_social)')
    .eq('tipo', 'factura_compra').neq('estado', 'cancelada')
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlertasStock() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('productos')
    .select('id, codigo, descripcion, stock(cantidad, cantidad_minima)')
    .eq('activo', true).limit(50)

  return (data ?? [])
    .map((p) => {
      const stocks = Array.isArray(p.stock) ? p.stock : []
      const stock_actual = stocks.reduce((s, st) => s + (st.cantidad ?? 0), 0)
      const stock_minimo = stocks.reduce((s, st) => s + (st.cantidad_minima ?? 0), 0)
      return { ...p, stock_actual, stock_minimo }
    })
    .filter(p => hasLowStock(p.stock))
}

export async function getFacturasVencidas(limit = 5) {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('documentos')
    .select('id, numero, prefijo, total, fecha_vencimiento, cliente:cliente_id(razon_social)')
    .eq('tipo', 'factura_venta').eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy).order('fecha_vencimiento').limit(limit)
  return data ?? []
}

// ── Top clientes este mes ─────────────────────────────────────────────────────

export async function getTopClientes(limit = 5) {
  const supabase = await createClient()
  const { inicio } = mesActual()
  const { data } = await supabase
    .from('documentos')
    .select('total, cliente:cliente_id(id, razon_social)')
    .eq('tipo', 'factura_venta').neq('estado', 'cancelada').gte('fecha', inicio)
  if (!data) return []
  const mapa: Record<string, { razon_social: string; total: number }> = {}
  for (const row of data) {
    const c = row.cliente as { id?: string; razon_social?: string } | null
    if (!c?.id) continue
    if (!mapa[c.id]) mapa[c.id] = { razon_social: c.razon_social ?? '—', total: 0 }
    mapa[c.id].total += row.total ?? 0
  }
  return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, limit)
}

// ── Compatibilidad legacy ─────────────────────────────────────────────────────

export async function getKPIs() {
  const d = await getKPIsDashboard()
  return {
    facturas_activas:  d.facturas_pendientes,
    total_facturado:   d.facturado_anio,
    costos_ventas:     d.costos_anio,
    ganancias:         d.ganancias_anio,
    margen_porcentaje: d.margen,
  }
}
