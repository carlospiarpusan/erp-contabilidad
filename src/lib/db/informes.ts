import { createClient } from '@/lib/supabase/server'

// ── Informe de Facturas ───────────────────────────────────────────────────────

export async function getInformeFacturas(params: {
  desde?: string; hasta?: string; estado?: string; cliente_id?: string
}) {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]
  const desde = params.desde || `${new Date().getFullYear()}-01-01`
  const hasta  = params.hasta  || hoy

  let q = supabase
    .from('documentos')
    .select('id, numero, prefijo, fecha, fecha_vencimiento, estado, subtotal, total_iva, total_descuento, total, total_costo, cliente:cliente_id(id, razon_social, numero_documento)', { count: 'exact' })
    .eq('tipo', 'factura_venta')
    .gte('fecha', desde).lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (params.estado)     q = q.eq('estado', params.estado)
  if (params.cliente_id) q = q.eq('cliente_id', params.cliente_id)

  const { data, count, error } = await q
  if (error) throw error

  const rows = data ?? []
  const totales = rows.reduce((acc, r) => ({
    subtotal:  acc.subtotal  + (r.subtotal  ?? 0),
    iva:       acc.iva       + (r.total_iva ?? 0),
    descuento: acc.descuento + (r.total_descuento ?? 0),
    total:     acc.total     + (r.total     ?? 0),
    costo:     acc.costo     + (r.total_costo ?? 0),
  }), { subtotal: 0, iva: 0, descuento: 0, total: 0, costo: 0 })

  return { facturas: rows, total: count ?? 0, totales }
}

// ── Informe de Clientes (Cartera) ─────────────────────────────────────────────

export async function getInformeClientes(params?: { desde?: string; hasta?: string }) {
  const supabase = await createClient()
  const hoy  = new Date().toISOString().split('T')[0]
  const desde = params?.desde || `${new Date().getFullYear()}-01-01`
  const hasta  = params?.hasta  || hoy

  const [facturasRes, recibosRes] = await Promise.all([
    supabase
      .from('documentos')
      .select('total, total_costo, estado, fecha, cliente:cliente_id(id, razon_social, numero_documento)')
      .eq('tipo', 'factura_venta').neq('estado', 'cancelada')
      .gte('fecha', desde).lte('fecha', hasta),
    supabase
      .from('recibos')
      .select('valor, fecha, cliente:cliente_id(id)')
      .eq('tipo', 'venta')
      .gte('fecha', desde).lte('fecha', hasta),
  ])

  const fRows = facturasRes.data ?? []
  const rRows = recibosRes.data ?? []

  // Aggregate by cliente
  const mapa: Record<string, {
    id: string; razon_social: string; numero_documento: string
    facturado: number; cobrado: number; por_cobrar: number; utilidad: number
    num_facturas: number
  }> = {}

  for (const r of fRows) {
    const c = r.cliente as { id?: string; razon_social?: string; numero_documento?: string } | null
    if (!c?.id) continue
    if (!mapa[c.id]) mapa[c.id] = {
      id: c.id, razon_social: c.razon_social ?? '—',
      numero_documento: c.numero_documento ?? '',
      facturado: 0, cobrado: 0, por_cobrar: 0, utilidad: 0, num_facturas: 0,
    }
    mapa[c.id].facturado    += r.total ?? 0
    mapa[c.id].utilidad     += (r.total ?? 0) - (r.total_costo ?? 0)
    mapa[c.id].num_facturas += 1
    if (r.estado === 'pendiente') mapa[c.id].por_cobrar += r.total ?? 0
  }

  for (const r of rRows) {
    const c = r.cliente as { id?: string } | null
    if (!c?.id || !mapa[c.id]) continue
    mapa[c.id].cobrado += r.valor ?? 0
  }

  return Object.values(mapa).sort((a, b) => b.facturado - a.facturado)
}

// ── Informe de Artículos (Inventario valorado) ────────────────────────────────

export async function getInformeArticulos(params?: { familia_id?: string; con_stock?: boolean }) {
  const supabase = await createClient()

  let q = supabase
    .from('productos')
    .select('id, codigo, descripcion, precio_venta, precio_compra, stock_actual, stock_minimo, activo, familia:familia_id(descripcion)')
    .eq('activo', true)
    .order('descripcion')

  if (params?.familia_id) q = q.eq('familia_id', params.familia_id)

  const { data, error } = await q
  if (error) throw error

  let rows = data ?? []
  if (params?.con_stock) rows = rows.filter(r => (r.stock_actual ?? 0) > 0)

  const totales = rows.reduce((acc, r) => ({
    unidades:  acc.unidades  + (r.stock_actual ?? 0),
    valor_costo:   acc.valor_costo   + ((r.stock_actual ?? 0) * (r.precio_compra ?? 0)),
    valor_venta:   acc.valor_venta   + ((r.stock_actual ?? 0) * (r.precio_venta ?? 0)),
  }), { unidades: 0, valor_costo: 0, valor_venta: 0 })

  return { productos: rows, totales }
}

// ── Informe Balances (Ventas vs Compras vs Gastos) ────────────────────────────

export async function getInformeBalances(params?: { anio?: number }) {
  const supabase = await createClient()
  const anio  = params?.anio ?? new Date().getFullYear()
  const desde = `${anio}-01-01`
  const hasta  = `${anio}-12-31`

  const [ventas, compras, gastos, cobros] = await Promise.all([
    supabase.from('documentos').select('fecha, total, total_costo, estado')
      .eq('tipo', 'factura_venta').neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total')
      .eq('tipo', 'factura_compra').neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('documentos').select('fecha, total')
      .eq('tipo', 'gasto').neq('estado', 'cancelada').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('recibos').select('fecha, valor').eq('tipo', 'venta').gte('fecha', desde).lte('fecha', hasta),
  ])

  const vRows = ventas.data ?? []
  const cRows = compras.data ?? []
  const gRows = gastos.data ?? []
  const rRows = cobros.data ?? []

  const meses = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const pad = `${anio}-${String(mes).padStart(2, '0')}`
    const sumF = (rows: { fecha?: string | null; total?: number | null }[]) =>
      rows.filter(r => r.fecha?.startsWith(pad)).reduce((s, r) => s + (r.total ?? 0), 0)
    const vMes = vRows.filter(r => r.fecha?.startsWith(pad))
    const facturado = vMes.reduce((s, r) => s + (r.total ?? 0), 0)
    const comprasMes = sumF(cRows)
    const gastosMes  = sumF(gRows)
    return {
      mes, nombre: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][i],
      ventas:   facturado,
      compras:  comprasMes,
      gastos:   gastosMes,
      cobrado:  rRows.filter(r => r.fecha?.startsWith(pad)).reduce((s, r) => s + (r.valor ?? 0), 0),
      utilidad: facturado - comprasMes - gastosMes,
    }
  })

  const totales = meses.reduce((acc, m) => ({
    ventas:   acc.ventas   + m.ventas,
    compras:  acc.compras  + m.compras,
    gastos:   acc.gastos   + m.gastos,
    cobrado:  acc.cobrado  + m.cobrado,
    utilidad: acc.utilidad + m.utilidad,
  }), { ventas: 0, compras: 0, gastos: 0, cobrado: 0, utilidad: 0 })

  const por_cobrar = vRows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0)

  return { meses, totales, por_cobrar, anio }
}
