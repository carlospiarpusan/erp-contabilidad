import { createClient } from '@/lib/supabase/server'

// ── Sumas y Saldos ────────────────────────────────────────────────────────────

export async function getSumasYSaldos(params: { desde: string; hasta: string }) {
  const supabase = await createClient()

  const { data: lineas, error } = await supabase
    .from('asientos_lineas')
    .select(`
      debe, haber,
      cuenta:cuenta_id(id, codigo, descripcion, tipo, nivel, naturaleza),
      asiento:asiento_id(fecha, empresa_id)
    `)
    .gte('asiento.fecha', params.desde)
    .lte('asiento.fecha', params.hasta)

  if (error) throw error

  const mapa: Record<string, {
    id: string; codigo: string; descripcion: string
    tipo: string; nivel: number; naturaleza: string
    debe: number; haber: number
  }> = {}

  for (const l of lineas ?? []) {
    const c = l.cuenta as { id?: string; codigo?: string; descripcion?: string; tipo?: string; nivel?: number; naturaleza?: string } | null
    const a = l.asiento as { fecha?: string } | null
    if (!c?.id || !a?.fecha) continue
    if (!mapa[c.id]) {
      mapa[c.id] = {
        id: c.id, codigo: c.codigo ?? '', descripcion: c.descripcion ?? '',
        tipo: c.tipo ?? '', nivel: c.nivel ?? 4, naturaleza: c.naturaleza ?? 'debito',
        debe: 0, haber: 0,
      }
    }
    mapa[c.id].debe  += l.debe  ?? 0
    mapa[c.id].haber += l.haber ?? 0
  }

  return Object.values(mapa)
    .filter(r => r.debe > 0 || r.haber > 0)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map(r => ({ ...r, saldo: r.debe - r.haber }))
}

// ── Balance de Situación ──────────────────────────────────────────────────────

export async function getBalanceSituacion(params: { fecha_corte: string }) {
  const supabase = await createClient()

  const desde = '2000-01-01'
  const rows = await getSumasYSaldos({ desde, hasta: params.fecha_corte })

  const activos    = rows.filter(r => r.tipo === 'activo')
  const pasivos    = rows.filter(r => r.tipo === 'pasivo')
  const patrimonio = rows.filter(r => r.tipo === 'patrimonio')

  const sum = (items: typeof rows) =>
    items.reduce((s, r) => s + (r.naturaleza === 'debito' ? r.debe - r.haber : r.haber - r.debe), 0)

  return {
    activos,    total_activos:    sum(activos),
    pasivos,    total_pasivos:    sum(pasivos),
    patrimonio, total_patrimonio: sum(patrimonio),
  }
}

// ── PyG — Pérdidas y Ganancias ────────────────────────────────────────────────

export async function getPyG(params: { desde: string; hasta: string }) {
  const supabase = await createClient()
  const rows = await getSumasYSaldos(params)

  const ingresos = rows.filter(r => r.tipo === 'ingreso')
  const costos   = rows.filter(r => r.tipo === 'costo')
  const gastos   = rows.filter(r => r.tipo === 'gasto')

  const sumIngreso = (items: typeof rows) =>
    items.reduce((s, r) => s + (r.haber - r.debe), 0)
  const sumEgreso = (items: typeof rows) =>
    items.reduce((s, r) => s + (r.debe - r.haber), 0)

  const total_ingresos = sumIngreso(ingresos)
  const total_costos   = sumEgreso(costos)
  const total_gastos   = sumEgreso(gastos)
  const utilidad       = total_ingresos - total_costos - total_gastos

  return { ingresos, costos, gastos, total_ingresos, total_costos, total_gastos, utilidad }
}

// ── Libro Mayor ───────────────────────────────────────────────────────────────

export async function getLibroMayor(params: { cuenta_id: string; desde: string; hasta: string }) {
  const supabase = await createClient()

  const { data: lineas, error } = await supabase
    .from('asientos_lineas')
    .select(`
      id, descripcion, debe, haber,
      asiento:asiento_id(id, numero, fecha, concepto, tipo_doc)
    `)
    .eq('cuenta_id', params.cuenta_id)
    .gte('asiento.fecha', params.desde)
    .lte('asiento.fecha', params.hasta)
    .order('asiento.fecha', { ascending: true })

  if (error) throw error

  const { data: cuenta } = await supabase
    .from('cuentas_puc')
    .select('codigo, descripcion, naturaleza')
    .eq('id', params.cuenta_id)
    .single()

  let saldoAcumulado = 0
  const movimientos = (lineas ?? []).map(l => {
    const a = l.asiento as { id?: string; numero?: number; fecha?: string; concepto?: string; tipo_doc?: string } | null
    saldoAcumulado += (l.debe ?? 0) - (l.haber ?? 0)
    return {
      asiento_id: a?.id ?? '',
      numero:     a?.numero ?? 0,
      fecha:      a?.fecha ?? '',
      concepto:   a?.concepto ?? l.descripcion ?? '',
      tipo_doc:   a?.tipo_doc ?? '',
      debe:       l.debe  ?? 0,
      haber:      l.haber ?? 0,
      saldo:      saldoAcumulado,
    }
  }).filter(l => l.fecha >= params.desde && l.fecha <= params.hasta)

  return { cuenta, movimientos }
}

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
    .select('id, codigo, descripcion, precio_venta, precio_compra, activo, familia:familia_id(nombre, descripcion), stock(cantidad, cantidad_minima)')
    .eq('activo', true)
    .order('descripcion')

  if (params?.familia_id) q = q.eq('familia_id', params.familia_id)

  const { data, error } = await q
  if (error) throw error

  let rows = (data ?? []).map((r) => {
    const stocks = Array.isArray(r.stock) ? r.stock : []
    const stock_actual = stocks.reduce((s, st) => s + (st.cantidad ?? 0), 0)
    const stock_minimo = stocks.reduce((s, st) => s + (st.cantidad_minima ?? 0), 0)
    return { ...r, stock_actual, stock_minimo }
  })
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
