import { createClient } from '@/lib/supabase/server'
import { getSession, type UserSession } from '@/lib/auth/session'
import { calcularFechaPagoSistecredito, isSistecreditoFormaPago } from '@/lib/utils/formas-pago'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ReportContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  session: UserSession
}

type CuentaResumen = {
  id: string
  codigo: string
  descripcion: string
  tipo: string
  nivel: number
  naturaleza: string
  debe: number
  haber: number
}

type AsientoMeta = {
  id: string
  numero?: number | null
  fecha?: string | null
  concepto?: string | null
  tipo_doc?: string | null
}

const REPORT_PAGE_SIZE = 500
const ASIENTO_IDS_CHUNK_SIZE = 100

async function withReportCache<T>(
  _scope: string,
  _params: Record<string, unknown>,
  query: (context: ReportContext) => Promise<T>
) {
  const session = await getSession()
  if (!session) throw new Error('No autenticado')
  const supabase = await createClient()
  return query({ supabase, session })
}

function isValidUUID(value: string) {
  return UUID_REGEX.test(value)
}

function getPreviousDate(date: string) {
  const base = new Date(`${date}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() - 1)
  return base.toISOString().slice(0, 10)
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>
) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const batch = await fetchPage(from, from + REPORT_PAGE_SIZE - 1)
    if (!batch.length) break
    rows.push(...batch)
    if (batch.length < REPORT_PAGE_SIZE) break
    from += REPORT_PAGE_SIZE
  }

  return rows
}

async function listAsientoIdsInRange(
  supabase: ReportContext['supabase'],
  empresaId: string,
  desde: string,
  hasta: string
) {
  const rows = await fetchAllRows<{ id?: string | null }>(async (from, to) => {
    const { data, error } = await supabase
      .from('asientos')
      .select('id')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error
    return (data ?? []) as Array<{ id?: string | null }>
  })

  return rows.flatMap((row) => (row.id ? [row.id] : []))
}

async function getAsientosMetaInRange(
  supabase: ReportContext['supabase'],
  empresaId: string,
  desde: string,
  hasta: string
) {
  return fetchAllRows<AsientoMeta>(async (from, to) => {
    const { data, error } = await supabase
      .from('asientos')
      .select('id, numero, fecha, concepto, tipo_doc')
      .eq('empresa_id', empresaId)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha', { ascending: true })
      .order('numero', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to)

    if (error) throw error
    return (data ?? []) as AsientoMeta[]
  })
}

async function getLineasByAsientoIds(
  supabase: ReportContext['supabase'],
  asientoIds: string[]
) {
  const lineas: Array<{
    debe: number | null
    haber: number | null
    cuenta: {
      id?: string
      codigo?: string
      descripcion?: string
      tipo?: string
      nivel?: number
      naturaleza?: string
    } | Array<{
      id?: string
      codigo?: string
      descripcion?: string
      tipo?: string
      nivel?: number
      naturaleza?: string
    }> | null
  }> = []

  for (let index = 0; index < asientoIds.length; index += ASIENTO_IDS_CHUNK_SIZE) {
    const chunk = asientoIds.slice(index, index + ASIENTO_IDS_CHUNK_SIZE)
    if (chunk.length === 0) continue

    const chunkRows = await fetchAllRows<typeof lineas[number]>(async (from, to) => {
      const { data, error } = await supabase
        .from('asientos_lineas')
        .select(`
          debe, haber,
          cuenta:cuenta_id(id, codigo, descripcion, tipo, nivel, naturaleza)
        `)
        .in('asiento_id', chunk)
        .order('id', { ascending: true })
        .range(from, to)

      if (error) throw error
      return ((data ?? []) as typeof lineas)
    })

    lineas.push(...chunkRows)
  }

  return lineas
}

async function getCuentaLineasByAsientoIds(
  supabase: ReportContext['supabase'],
  cuentaId: string,
  asientoIds: string[]
) {
  const lineas: Array<{
    id: string
    asiento_id: string
    descripcion: string | null
    debe: number | null
    haber: number | null
  }> = []

  for (let index = 0; index < asientoIds.length; index += ASIENTO_IDS_CHUNK_SIZE) {
    const chunk = asientoIds.slice(index, index + ASIENTO_IDS_CHUNK_SIZE)
    if (chunk.length === 0) continue

    const chunkRows = await fetchAllRows<typeof lineas[number]>(async (from, to) => {
      const { data, error } = await supabase
        .from('asientos_lineas')
        .select('id, asiento_id, descripcion, debe, haber')
        .eq('cuenta_id', cuentaId)
        .in('asiento_id', chunk)
        .order('id', { ascending: true })
        .range(from, to)

      if (error) throw error
      return (data ?? []) as typeof lineas
    })

    lineas.push(...chunkRows)
  }

  return lineas
}

type CarteraDeudor = {
  id: string | null
  razon_social: string
  numero_documento: string | null
  email: string | null
  telefono: string | null
  tipo: 'cliente' | 'sistecredito'
}

function getDeudorCartera(
  cliente: { id?: string; razon_social?: string; numero_documento?: string; email?: string; telefono?: string } | null,
  formaPago: { descripcion?: string } | null
): CarteraDeudor {
  if (isSistecreditoFormaPago(formaPago)) {
    return {
      id: null,
      razon_social: 'Sistecrédito',
      numero_documento: null,
      email: null,
      telefono: null,
      tipo: 'sistecredito',
    }
  }

  return {
    id: cliente?.id ?? null,
    razon_social: cliente?.razon_social ?? 'Sin cliente',
    numero_documento: cliente?.numero_documento ?? null,
    email: cliente?.email ?? null,
    telefono: cliente?.telefono ?? null,
    tipo: 'cliente',
  }
}

// ── Sumas y Saldos ────────────────────────────────────────────────────────────

export async function getSumasYSaldos(params: { desde: string; hasta: string }) {
  return withReportCache('sumas-saldos', params, async ({ supabase, session }) => {
    const asientoIds = await listAsientoIdsInRange(
      supabase,
      session.empresa_id,
      params.desde,
      params.hasta
    )

    if (asientoIds.length === 0) return []

    const lineas = await getLineasByAsientoIds(supabase, asientoIds)

    const mapa: Record<string, CuentaResumen> = {}

    for (const l of lineas) {
      const c = Array.isArray(l.cuenta) ? l.cuenta[0] : l.cuenta
      if (!c?.id) continue
      if (!mapa[c.id]) {
        mapa[c.id] = {
          id: c.id,
          codigo: c.codigo ?? '',
          descripcion: c.descripcion ?? '',
          tipo: c.tipo ?? '',
          nivel: c.nivel ?? 4,
          naturaleza: c.naturaleza ?? 'debito',
          debe: 0,
          haber: 0,
        }
      }
      mapa[c.id].debe += l.debe ?? 0
      mapa[c.id].haber += l.haber ?? 0
    }

    return Object.values(mapa)
      .filter(r => r.debe > 0 || r.haber > 0)
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map(r => ({ ...r, saldo: r.debe - r.haber }))
  })
}

// ── Balance de Situación ──────────────────────────────────────────────────────

export async function getBalanceSituacion(params: { fecha_corte: string }) {
  return withReportCache('balance-situacion', params, async () => {
    const desde = '2000-01-01'
    const rows = await getSumasYSaldos({ desde, hasta: params.fecha_corte })

    const activos = rows.filter(r => r.tipo === 'activo')
    const pasivos = rows.filter(r => r.tipo === 'pasivo')
    const patrimonio = rows.filter(r => r.tipo === 'patrimonio')

    const sum = (items: typeof rows) =>
      items.reduce((s, r) => s + (r.naturaleza === 'debito' ? r.debe - r.haber : r.haber - r.debe), 0)

    return {
      activos, total_activos: sum(activos),
      pasivos, total_pasivos: sum(pasivos),
      patrimonio, total_patrimonio: sum(patrimonio),
    }
  })
}

// ── PyG — Pérdidas y Ganancias ────────────────────────────────────────────────

export async function getPyG(params: { desde: string; hasta: string }) {
  return withReportCache('pyg', params, async () => {
    const rows = await getSumasYSaldos(params)

    const ingresos = rows.filter(r => r.tipo === 'ingreso')
    const costos = rows.filter(r => r.tipo === 'costo')
    const gastos = rows.filter(r => r.tipo === 'gasto')

    const sumIngreso = (items: typeof rows) =>
      items.reduce((s, r) => s + (r.haber - r.debe), 0)
    const sumEgreso = (items: typeof rows) =>
      items.reduce((s, r) => s + (r.debe - r.haber), 0)

    const total_ingresos = sumIngreso(ingresos)
    const total_costos = sumEgreso(costos)
    const total_gastos = sumEgreso(gastos)
    const utilidad = total_ingresos - total_costos - total_gastos

    return { ingresos, costos, gastos, total_ingresos, total_costos, total_gastos, utilidad }
  })
}

// ── Libro Mayor ───────────────────────────────────────────────────────────────

export async function getLibroMayor(params: { cuenta_id: string; desde: string; hasta: string }) {
  if (!isValidUUID(params.cuenta_id)) {
    return { cuenta: null, movimientos: [] }
  }

  return withReportCache('libro-mayor', params, async ({ supabase, session }) => {
    const { data: cuenta } = await supabase
      .from('cuentas_puc')
      .select('codigo, descripcion, naturaleza')
      .eq('empresa_id', session.empresa_id)
      .eq('id', params.cuenta_id)
      .single()

    const hastaSaldoInicial = getPreviousDate(params.desde)
    const [asientosPeriodo, asientoIdsSaldoInicial] = await Promise.all([
      getAsientosMetaInRange(supabase, session.empresa_id, params.desde, params.hasta),
      hastaSaldoInicial >= '2000-01-01'
        ? listAsientoIdsInRange(supabase, session.empresa_id, '2000-01-01', hastaSaldoInicial)
        : Promise.resolve([] as string[]),
    ])

    const [lineasPeriodo, lineasSaldoInicial] = await Promise.all([
      getCuentaLineasByAsientoIds(
        supabase,
        params.cuenta_id,
        asientosPeriodo.map((asiento) => asiento.id)
      ),
      asientoIdsSaldoInicial.length > 0
        ? getCuentaLineasByAsientoIds(supabase, params.cuenta_id, asientoIdsSaldoInicial)
        : Promise.resolve([] as Awaited<ReturnType<typeof getCuentaLineasByAsientoIds>>),
    ])

    const asientoMap = new Map(asientosPeriodo.map((asiento) => [asiento.id, asiento]))
    const saldoInicial = lineasSaldoInicial.reduce(
      (sum, linea) => sum + Number(linea.debe ?? 0) - Number(linea.haber ?? 0),
      0
    )

    let saldoAcumulado = saldoInicial
    const movimientosPeriodo = lineasPeriodo
      .map((linea) => ({
        linea,
        asiento: asientoMap.get(linea.asiento_id) ?? null,
      }))
      .filter((row) => row.asiento?.fecha)
      .sort((a, b) => {
        const fechaA = a.asiento?.fecha ?? ''
        const fechaB = b.asiento?.fecha ?? ''
        if (fechaA !== fechaB) return fechaA.localeCompare(fechaB)
        const numeroA = Number(a.asiento?.numero ?? 0)
        const numeroB = Number(b.asiento?.numero ?? 0)
        if (numeroA !== numeroB) return numeroA - numeroB
        return a.linea.id.localeCompare(b.linea.id)
      })
      .map(({ linea, asiento }) => {
        saldoAcumulado += Number(linea.debe ?? 0) - Number(linea.haber ?? 0)
        return {
          asiento_id: asiento?.id ?? '',
          numero: asiento?.numero ?? 0,
          fecha: asiento?.fecha ?? '',
          concepto: asiento?.concepto ?? linea.descripcion ?? '',
          tipo_doc: asiento?.tipo_doc ?? '',
          debe: Number(linea.debe ?? 0),
          haber: Number(linea.haber ?? 0),
          saldo: saldoAcumulado,
        }
      })

    const movimientos = saldoInicial !== 0
      ? [{
        asiento_id: '',
        numero: 0,
        fecha: params.desde,
        concepto: 'Saldo inicial',
        tipo_doc: 'saldo_inicial',
        debe: 0,
        haber: 0,
        saldo: saldoInicial,
      }, ...movimientosPeriodo]
      : movimientosPeriodo

    return { cuenta, movimientos }
  })
}

// ── Informe de Facturas ───────────────────────────────────────────────────────

export async function getInformeFacturas(params: {
  desde?: string; hasta?: string; estado?: string; cliente_id?: string
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const desde = params.desde || `${new Date().getFullYear()}-01-01`
  const hasta = params.hasta || hoy
  const estado = params.estado || ''
  const cliente_id = params.cliente_id || ''

  return withReportCache('informe-facturas', { desde, hasta, estado, cliente_id }, async ({ supabase, session }) => {
    const rows = await fetchAllRows<any>(async (from, to) => {
      let q = supabase
        .from('documentos')
        .select('id, numero, prefijo, fecha, fecha_vencimiento, estado, subtotal, total_iva, total_descuento, total, total_costo, cliente:cliente_id(id, razon_social, numero_documento)')
        .eq('empresa_id', session.empresa_id)
        .eq('tipo', 'factura_venta')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(from, to)

      if (estado) q = q.eq('estado', estado)
      if (cliente_id) q = q.eq('cliente_id', cliente_id)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    })

    const totales = rows.reduce((acc, r) => ({
      subtotal: acc.subtotal + (r.subtotal ?? 0),
      iva: acc.iva + (r.total_iva ?? 0),
      descuento: acc.descuento + (r.total_descuento ?? 0),
      total: acc.total + (r.total ?? 0),
      costo: acc.costo + (r.total_costo ?? 0),
    }), { subtotal: 0, iva: 0, descuento: 0, total: 0, costo: 0 })

    return { facturas: rows, total: rows.length, totales }
  })
}

// ── Ventas por Medio de Pago ────────────────────────────────────────────────

export async function getInformeVentasPorMedioPago(params?: { desde?: string; hasta?: string; forma_pago_id?: string }) {
  const hoy = new Date().toISOString().split('T')[0]
  const inicioMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
  const desde = params?.desde || inicioMes
  const hasta = params?.hasta || hoy
  const forma_pago_id = params?.forma_pago_id || ''

  return withReportCache('ventas-por-medio-pago', { desde, hasta, forma_pago_id }, async ({ supabase, session }) => {
    const rows = await fetchAllRows<any>(async (from, to) => {
      let query = supabase
        .from('documentos')
        .select('id, numero, prefijo, fecha, estado, total, cliente:cliente_id(id, razon_social), forma_pago:forma_pago_id(id, descripcion)')
        .eq('empresa_id', session.empresa_id)
        .eq('tipo', 'factura_venta')
        .neq('estado', 'cancelada')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false })
        .order('numero', { ascending: false })
        .range(from, to)

      if (forma_pago_id === 'sin-forma') query = query.is('forma_pago_id', null)
      else if (forma_pago_id && isValidUUID(forma_pago_id)) query = query.eq('forma_pago_id', forma_pago_id)

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    })

    const mapa: Record<string, {
      id: string | null
      descripcion: string
      facturas: number
      total: number
      pagadas: number
      pendientes: number
      ultima_fecha: string | null
    }> = {}

    for (const row of rows) {
      const forma = row.forma_pago as { id?: string; descripcion?: string } | null
      const key = forma?.id ?? 'sin-forma'

      if (!mapa[key]) {
        mapa[key] = {
          id: forma?.id ?? null,
          descripcion: forma?.descripcion ?? 'Sin forma de pago',
          facturas: 0,
          total: 0,
          pagadas: 0,
          pendientes: 0,
          ultima_fecha: row.fecha ?? null,
        }
      }

      mapa[key].facturas += 1
      mapa[key].total += row.total ?? 0
      if (row.estado === 'pagada') mapa[key].pagadas += 1
      else mapa[key].pendientes += 1
      if (row.fecha && (!mapa[key].ultima_fecha || row.fecha > mapa[key].ultima_fecha)) {
        mapa[key].ultima_fecha = row.fecha
      }
    }

    const medios = Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .map((item) => ({
        ...item,
        ticket_promedio: item.facturas > 0 ? item.total / item.facturas : 0,
      }))

    const facturas = rows.map((row) => ({
      id: row.id,
      numero: row.numero,
      prefijo: row.prefijo,
      fecha: row.fecha,
      estado: row.estado,
      total: row.total ?? 0,
      cliente: row.cliente as { id?: string; razon_social?: string } | null,
      forma_pago: row.forma_pago as { id?: string; descripcion?: string } | null,
    }))

    const totalVentas = medios.reduce((sum, item) => sum + item.total, 0)
    const totalFacturas = medios.reduce((sum, item) => sum + item.facturas, 0)

    return {
      desde,
      hasta,
      forma_pago_id,
      medios,
      facturas,
      resumen: {
        total_ventas: totalVentas,
        total_facturas: totalFacturas,
        ticket_promedio: totalFacturas > 0 ? totalVentas / totalFacturas : 0,
      },
    }
  })
}

// ── Informe de Clientes (Cartera) ─────────────────────────────────────────────

export async function getInformeCartera() {
  return withReportCache('informe-cartera', {}, async ({ supabase, session }) => {
    const hoy = new Date()

    const documentos = await fetchAllRows<any>(async (from, to) => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          id, numero, prefijo, fecha, fecha_vencimiento, total, estado,
          cliente:cliente_id(id, razon_social, numero_documento, email, telefono),
          forma_pago:forma_pago_id(id, descripcion),
          recibos(valor)
        `)
        .eq('empresa_id', session.empresa_id)
        .eq('tipo', 'factura_venta')
        .in('estado', ['pendiente', 'vencida'])
        .order('fecha_vencimiento', { ascending: true })
        .order('numero', { ascending: true })
        .range(from, to)

      if (error) throw error
      return data ?? []
    })

    const filas = documentos.map((doc) => {
      const cliente = doc.cliente as {
        id?: string
        razon_social?: string
        numero_documento?: string
        email?: string
        telefono?: string
      } | null
      const formaPago = doc.forma_pago as { id?: string; descripcion?: string } | null
      const deudor = getDeudorCartera(cliente, formaPago)
      const recibos = Array.isArray(doc.recibos) ? (doc.recibos as Array<{ valor?: number | null }>) : []
      const pagado = recibos.reduce((sum, recibo) => sum + Number(recibo.valor ?? 0), 0)
      const saldo = (doc.total ?? 0) - pagado
      const fechaGestion = deudor.tipo === 'sistecredito'
        ? calcularFechaPagoSistecredito(doc.fecha ?? '')
        : doc.fecha_vencimiento
      const vencimiento = fechaGestion ? new Date(`${fechaGestion}T12:00:00`) : null
      const diasVencido = vencimiento ? Math.floor((hoy.getTime() - vencimiento.getTime()) / 86400000) : null

      let rango = 'vigente'
      if (diasVencido !== null && diasVencido > 0) {
        if (diasVencido <= 30) rango = '0-30 días'
        else if (diasVencido <= 60) rango = '31-60 días'
        else if (diasVencido <= 90) rango = '61-90 días'
        else rango = '+90 días'
      }

      return {
        id: doc.id,
        numero: `${doc.prefijo}${doc.numero}`,
        fecha: doc.fecha,
        fecha_vencimiento: doc.fecha_vencimiento,
        fecha_gestion: fechaGestion,
        total: doc.total ?? 0,
        pagado,
        saldo,
        dias_vencido: diasVencido,
        rango,
        deudor,
        cliente,
        forma_pago: formaPago,
      }
    }).filter((fila) => fila.saldo > 0.01)

    const resumen = filas.reduce((acc, fila) => {
      acc.total += fila.saldo
      acc.rangos[fila.rango] = (acc.rangos[fila.rango] ?? 0) + fila.saldo
      return acc
    }, {
      total: 0,
      rangos: {
        vigente: 0,
        '0-30 días': 0,
        '31-60 días': 0,
        '61-90 días': 0,
        '+90 días': 0,
      } as Record<string, number>,
    })

    return { filas, resumen, total: resumen.total }
  })
}

export async function getInformeClientes(params?: { desde?: string; hasta?: string }) {
  const hoy  = new Date().toISOString().split('T')[0]
  const desde = params?.desde || `${new Date().getFullYear()}-01-01`
  const hasta  = params?.hasta  || hoy

  return withReportCache('informe-clientes', { desde, hasta }, async ({ supabase, session }) => {
    const fRows = await fetchAllRows<any>(async (from, to) => {
      const { data, error } = await supabase
        .from('documentos')
        .select(`
          total, total_costo, estado, fecha,
          cliente:cliente_id(id, razon_social, numero_documento),
          forma_pago:forma_pago_id(descripcion),
          recibos(valor, fecha)
        `)
        .eq('empresa_id', session.empresa_id)
        .eq('tipo', 'factura_venta')
        .neq('estado', 'cancelada')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)

      if (error) throw error
      return data ?? []
    })

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
      mapa[c.id].facturado += r.total ?? 0
      mapa[c.id].utilidad += (r.total ?? 0) - (r.total_costo ?? 0)
      mapa[c.id].num_facturas += 1
      const formaPago = r.forma_pago as { descripcion?: string } | null
      const recibos = Array.isArray(r.recibos) ? (r.recibos as Array<{ valor?: number | null }>) : []
      const totalCobrado = recibos.reduce((sum, recibo) => sum + Number(recibo.valor ?? 0), 0)
      mapa[c.id].cobrado += totalCobrado
      if ((r.estado === 'pendiente' || r.estado === 'vencida') && !isSistecreditoFormaPago(formaPago)) {
        mapa[c.id].por_cobrar += Math.max(0, (r.total ?? 0) - totalCobrado)
      }
    }

    return Object.values(mapa).sort((a, b) => b.facturado - a.facturado)
  })
}

// ── Informe de Artículos (Inventario valorado) ────────────────────────────────

export async function getInformeArticulos(params?: { familia_id?: string; con_stock?: boolean }) {
  const familia_id = params?.familia_id || ''
  const con_stock = Boolean(params?.con_stock)

  return withReportCache('informe-articulos', { familia_id, con_stock }, async ({ supabase, session }) => {
    const productos = await fetchAllRows<any>(async (from, to) => {
      let q = supabase
        .from('productos')
        .select('id, codigo, descripcion, precio_venta, precio_compra, activo, familia:familia_id(nombre, descripcion), stock(cantidad, cantidad_minima)')
        .eq('empresa_id', session.empresa_id)
        .eq('activo', true)
        .order('descripcion')
        .range(from, to)

      if (familia_id) q = q.eq('familia_id', familia_id)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    })

    let rows = productos.map((r) => {
      const stocks = Array.isArray(r.stock) ? (r.stock as Array<{ cantidad?: number | null; cantidad_minima?: number | null }>) : []
      const stock_actual = stocks.reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
      const stock_minimo = stocks.reduce((sum, stock) => sum + Number(stock.cantidad_minima ?? 0), 0)
      return { ...r, stock_actual, stock_minimo }
    })
    if (con_stock) rows = rows.filter(r => (r.stock_actual ?? 0) > 0)

    const totales = rows.reduce((acc, r) => ({
      unidades: acc.unidades + (r.stock_actual ?? 0),
      valor_costo: acc.valor_costo + ((r.stock_actual ?? 0) * (r.precio_compra ?? 0)),
      valor_venta: acc.valor_venta + ((r.stock_actual ?? 0) * (r.precio_venta ?? 0)),
    }), { unidades: 0, valor_costo: 0, valor_venta: 0 })

    return { productos: rows, totales }
  })
}

// ── Informe Balances (Ventas vs Compras vs Gastos) ────────────────────────────

export async function getInformeBalances(params?: { anio?: number }) {
  const anio  = params?.anio ?? new Date().getFullYear()
  const desde = `${anio}-01-01`
  const hasta  = `${anio}-12-31`

  return withReportCache('informe-balances', { anio }, async ({ supabase, session }) => {
    const [ventas, compras, gastos, cobros] = await Promise.all([
      fetchAllRows<any>(async (from, to) => {
        const { data, error } = await supabase
          .from('documentos')
          .select('fecha, total, total_costo, estado')
          .eq('empresa_id', session.empresa_id)
          .eq('tipo', 'factura_venta')
          .neq('estado', 'cancelada')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        if (error) throw error
        return data ?? []
      }),
      fetchAllRows<any>(async (from, to) => {
        const { data, error } = await supabase
          .from('documentos')
          .select('fecha, total')
          .eq('empresa_id', session.empresa_id)
          .eq('tipo', 'factura_compra')
          .neq('estado', 'cancelada')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        if (error) throw error
        return data ?? []
      }),
      fetchAllRows<any>(async (from, to) => {
        const { data, error } = await supabase
          .from('documentos')
          .select('fecha, total')
          .eq('empresa_id', session.empresa_id)
          .eq('tipo', 'gasto')
          .neq('estado', 'cancelada')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        if (error) throw error
        return data ?? []
      }),
      fetchAllRows<any>(async (from, to) => {
        const { data, error } = await supabase
          .from('recibos')
          .select('fecha, valor')
          .eq('empresa_id', session.empresa_id)
          .eq('tipo', 'venta')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)
        if (error) throw error
        return data ?? []
      }),
    ])

    const vRows = ventas
    const cRows = compras
    const gRows = gastos
    const rRows = cobros

    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const pad = `${anio}-${String(mes).padStart(2, '0')}`
      const sumF = (rows: { fecha?: string | null; total?: number | null }[]) =>
        rows.filter(r => r.fecha?.startsWith(pad)).reduce((s, r) => s + (r.total ?? 0), 0)
      const vMes = vRows.filter(r => r.fecha?.startsWith(pad))
      const facturado = vMes.reduce((s, r) => s + (r.total ?? 0), 0)
      const comprasMes = sumF(cRows)
      const gastosMes = sumF(gRows)
      return {
        mes, nombre: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
        ventas: facturado,
        compras: comprasMes,
        gastos: gastosMes,
        cobrado: rRows.filter(r => r.fecha?.startsWith(pad)).reduce((s, r) => s + (r.valor ?? 0), 0),
        utilidad: facturado - comprasMes - gastosMes,
      }
    })

    const totales = meses.reduce((acc, m) => ({
      ventas: acc.ventas + m.ventas,
      compras: acc.compras + m.compras,
      gastos: acc.gastos + m.gastos,
      cobrado: acc.cobrado + m.cobrado,
      utilidad: acc.utilidad + m.utilidad,
    }), { ventas: 0, compras: 0, gastos: 0, cobrado: 0, utilidad: 0 })

    const por_cobrar = vRows.filter(r => r.estado === 'pendiente').reduce((s, r) => s + (r.total ?? 0), 0)

    return { meses, totales, por_cobrar, anio }
  })
}

// ── Sugerido de Compra ────────────────────────────────────────────────────────
//
// Algoritmo:
//   1. Calcula unidades vendidas por producto en los últimos N días (ventana_dias)
//   2. Calcula velocidad diaria = unidades / ventana_dias
//   3. Calcula días hasta agotar stock = stock_actual / velocidad_diaria
//   4. Toma ventas del mismo mes en años anteriores (hasta 3 años) para calcular
//      un factor estacional: si en ese mes históricamente se vende 20% más, sube el pedido
//   5. Cantidad sugerida = MAX(0, demanda_proyectada_dias * lead_time + stock_seguridad - stock_actual)
//      donde lead_time = 30 días por defecto y stock_seguridad = 15 días de venta

export type PrioridadSugeridoCompra = 'urgente' | 'media' | 'baja' | 'sin_movimiento'

export interface SugeridoCompraItem {
  id: string
  codigo: string
  descripcion: string
  familia: string
  precio_compra: number
  stock_actual: number
  stock_minimo: number
  ventas_ventana: number
  ventas_mes_actual: number
  ventas_mes_historico_prom: number
  proyeccion_mensual: number
  dias_cobertura: number | null
  cantidad_sugerida: number
  valor_pedido: number
  prioridad: PrioridadSugeridoCompra
  motivo: string
}

export interface SugeridoCompraDiagnostico {
  facturas_venta: number
  lineas_producto: number
  agregados_producto: number
  productos_con_stock_negativo: number
  productos_con_stock_minimo: number
  productos_bajo_minimo: number
  sin_historial_producto: boolean
}

export interface SugeridoCompraResult {
  items: SugeridoCompraItem[]
  diagnostico: SugeridoCompraDiagnostico
}

type VentasPorProducto = Record<string, number>
type VentasHistoricasPorProducto = Record<string, Record<number, number>>

type ProductoSugeridoRow = {
  id: string
  codigo: string
  descripcion: string
  precio_compra?: number | null
  familia?: { nombre?: string } | null
  stock?: Array<{ cantidad?: number | null; cantidad_minima?: number | null }> | null
}

type RangoHistorico = {
  anio: number
  desde: string
  hasta: string
}

function acumularVentas(
  rows: Array<{ producto_id?: string | null; cantidad?: number | null; cantidad_total?: number | null }>,
  key: 'cantidad' | 'cantidad_total'
) {
  const result: VentasPorProducto = {}
  for (const row of rows) {
    if (!row.producto_id) continue
    result[row.producto_id] = (result[row.producto_id] ?? 0) + Number(row[key] ?? 0)
  }
  return result
}

function acumularHistoricoPorAnio(
  rows: Array<{ producto_id?: string | null; cantidad?: number | null; cantidad_total?: number | null }>,
  key: 'cantidad' | 'cantidad_total',
  anio: number,
  target: VentasHistoricasPorProducto
) {
  for (const row of rows) {
    if (!row.producto_id) continue
    if (!target[row.producto_id]) target[row.producto_id] = {}
    target[row.producto_id][anio] = (target[row.producto_id][anio] ?? 0) + Number(row[key] ?? 0)
  }
}

function construirSugeridosCompra(params: {
  productos: ProductoSugeridoRow[]
  ventasVentana: VentasPorProducto
  ventasMesActual: VentasPorProducto
  ventasMismoMesHistorico: VentasHistoricasPorProducto
  ventanaDias: number
  leadTime: number
  incluirSinMovimiento: boolean
  sinHistorialProducto: boolean
  maxItems: number
  diasMesActual: number
  diaActualMes: number
}): SugeridoCompraItem[] {
  const segDias = 15

  const resultados = params.productos.map((producto) => {
    const stocks = Array.isArray(producto.stock) ? producto.stock : []
    const stock_actual = stocks.reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
    const stock_minimo = stocks.reduce((sum, stock) => sum + Number(stock.cantidad_minima ?? 0), 0)
    const familia = producto.familia?.nombre ?? '—'

    const ventas_ventana = params.ventasVentana[producto.id] ?? 0
    const venta_diaria_ventana = ventas_ventana > 0 ? ventas_ventana / params.ventanaDias : 0
    const base_mensual_ventana = venta_diaria_ventana * 30

    const ventas_mes_actual = params.ventasMesActual[producto.id] ?? 0
    const proyeccion_mes_actual = ventas_mes_actual > 0
      ? (ventas_mes_actual / params.diaActualMes) * params.diasMesActual
      : 0

    const historicoValores = Object.values(params.ventasMismoMesHistorico[producto.id] ?? {}).filter((value) => value > 0)
    const ventas_mes_historico_prom = historicoValores.length > 0
      ? historicoValores.reduce((sum, value) => sum + value, 0) / historicoValores.length
      : 0

    let sumaPesos = 0
    let sumaProyeccion = 0
    if (base_mensual_ventana > 0) {
      sumaPesos += 0.45
      sumaProyeccion += base_mensual_ventana * 0.45
    }
    if (proyeccion_mes_actual > 0) {
      sumaPesos += 0.35
      sumaProyeccion += proyeccion_mes_actual * 0.35
    }
    if (ventas_mes_historico_prom > 0) {
      sumaPesos += 0.20
      sumaProyeccion += ventas_mes_historico_prom * 0.20
    }
    const proyeccion_ponderada_mensual = sumaPesos > 0 ? (sumaProyeccion / sumaPesos) : 0

    let factor_estacional = 1
    if (ventas_mes_historico_prom > 0 && base_mensual_ventana > 0) {
      factor_estacional = Math.max(0.6, Math.min(2.2, ventas_mes_historico_prom / base_mensual_ventana))
    }

    const proyeccion_mensual = Math.max(
      proyeccion_ponderada_mensual,
      base_mensual_ventana * factor_estacional
    )
    const demanda_diaria = proyeccion_mensual / 30
    const dias_cobertura = demanda_diaria > 0 ? (stock_actual / demanda_diaria) : null

    const dias_planeacion = params.leadTime + segDias
    const stock_objetivo = Math.max(stock_minimo, demanda_diaria * dias_planeacion)
    const cantidad_sugerida = Math.max(0, Math.ceil(stock_objetivo - stock_actual))

    let prioridad: PrioridadSugeridoCompra = 'baja'
    if (demanda_diaria <= 0 && stock_actual >= stock_minimo) {
      prioridad = 'sin_movimiento'
    } else if (cantidad_sugerida <= 0) {
      prioridad = 'baja'
    } else if (dias_cobertura !== null && dias_cobertura <= params.leadTime) {
      prioridad = 'urgente'
    } else if (dias_cobertura !== null && dias_cobertura <= dias_planeacion) {
      prioridad = 'media'
    } else if (stock_actual < stock_minimo) {
      prioridad = 'media'
    }

    const motivo = [
      stock_actual < stock_minimo ? 'Stock debajo del mínimo' : null,
      dias_cobertura !== null && dias_cobertura <= params.leadTime ? 'Cobertura menor al lead time' : null,
      factor_estacional >= 1.1 ? 'Mes estacionalmente alto' : null,
    ].filter(Boolean).join(' · ')

    const motivoFinal =
      params.sinHistorialProducto && !motivo
        ? 'Sin historial por producto; sugerido basado en stock actual y mínimo.'
        : motivo || 'Reposición por proyección de demanda'

    return {
      id: producto.id,
      codigo: producto.codigo,
      descripcion: producto.descripcion,
      familia,
      precio_compra: Number(producto.precio_compra ?? 0),
      stock_actual: Math.round(stock_actual * 1000) / 1000,
      stock_minimo: Math.round(stock_minimo * 1000) / 1000,
      ventas_ventana: Math.round(ventas_ventana * 1000) / 1000,
      ventas_mes_actual: Math.round(ventas_mes_actual * 1000) / 1000,
      ventas_mes_historico_prom: Math.round(ventas_mes_historico_prom * 1000) / 1000,
      proyeccion_mensual: Math.round(proyeccion_mensual * 1000) / 1000,
      dias_cobertura: dias_cobertura === null ? null : Math.round(dias_cobertura * 10) / 10,
      cantidad_sugerida,
      valor_pedido: cantidad_sugerida * Number(producto.precio_compra ?? 0),
      prioridad,
      motivo: motivoFinal,
    }
  })

  return resultados
    .filter((row) => row.cantidad_sugerida > 0)
    .filter((row) => {
      const tieneActividad =
        row.ventas_ventana > 0 ||
        row.ventas_mes_actual > 0 ||
        row.ventas_mes_historico_prom > 0
      const tieneFaltanteStock = row.stock_actual < row.stock_minimo || row.stock_actual < 0

      return params.incluirSinMovimiento ||
        tieneActividad ||
        (params.sinHistorialProducto && tieneFaltanteStock)
    })
    .sort((a, b) => {
      const orden = { urgente: 0, media: 1, baja: 2, sin_movimiento: 3 }
      const diff = orden[a.prioridad] - orden[b.prioridad]
      if (diff !== 0) return diff
      return b.cantidad_sugerida - a.cantidad_sugerida
    })
    .slice(0, params.maxItems)
}

function shouldFallbackToRaw(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code ?? '') : ''
  const message = typeof error === 'object' && error !== null && 'message' in error ? String((error as { message?: string }).message ?? '') : ''
  return code === '42P01' || code === '42501' || message.includes('ventas_producto_diarias')
}

async function getVentasSugeridoDesdeAgregados(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  empresaId: string
  desde: string
  hasta: string
  inicioMesActual: string
  rangosMismoMesHistorico: RangoHistorico[]
}) {
  const fetchRange = (desde: string, hasta: string) =>
    fetchAllRows<Array<{ producto_id?: string | null; cantidad_total?: number | null }>[number]>(async (from, to) => {
      const { data, error } = await params.supabase
        .from('ventas_producto_diarias')
        .select('producto_id, cantidad_total')
        .eq('empresa_id', params.empresaId)
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true })
        .order('producto_id', { ascending: true })
        .range(from, to)

      if (error) throw error
      return (data ?? []) as Array<{ producto_id?: string | null; cantidad_total?: number | null }>
    })

  const [ventasVentanaRows, ventasMesActualRows, ...historicasRows] = await Promise.all([
    fetchRange(params.desde, params.hasta),
    fetchRange(params.inicioMesActual, params.hasta),
    ...params.rangosMismoMesHistorico.map((rango) => fetchRange(rango.desde, rango.hasta)),
  ])

  const ventasMismoMesHistorico: VentasHistoricasPorProducto = {}
  for (let index = 0; index < historicasRows.length; index += 1) {
    const anio = params.rangosMismoMesHistorico[index]?.anio
    if (!anio) continue
    acumularHistoricoPorAnio(
      historicasRows[index] ?? [],
      'cantidad_total',
      anio,
      ventasMismoMesHistorico
    )
  }

  return {
    ventasVentana: acumularVentas(ventasVentanaRows, 'cantidad_total'),
    ventasMesActual: acumularVentas(ventasMesActualRows, 'cantidad_total'),
    ventasMismoMesHistorico,
  }
}

async function getVentasSugeridoDesdeLineas(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  empresaId: string
  desde: string
  hasta: string
  inicioMesActual: string
  rangosMismoMesHistorico: RangoHistorico[]
}) {
  const lineasSelect = 'producto_id, cantidad, documento:documentos!inner(fecha, tipo, estado, empresa_id)'

  const fetchRange = (desde: string, hasta: string) =>
    fetchAllRows<Array<{ producto_id?: string | null; cantidad?: number | null }>[number]>(async (from, to) => {
      const { data, error } = await params.supabase
        .from('documentos_lineas')
        .select(lineasSelect)
        .eq('documento.empresa_id', params.empresaId)
        .eq('documento.tipo', 'factura_venta')
        .neq('documento.estado', 'cancelada')
        .gte('documento.fecha', desde)
        .lte('documento.fecha', hasta)
        .order('id', { ascending: true })
        .range(from, to)

      if (error) throw error
      return (data ?? []) as Array<{ producto_id?: string | null; cantidad?: number | null }>
    })

  const [ventasVentanaRows, ventasMesActualRows, ...historicasRows] = await Promise.all([
    fetchRange(params.desde, params.hasta),
    fetchRange(params.inicioMesActual, params.hasta),
    ...params.rangosMismoMesHistorico.map((rango) => fetchRange(rango.desde, rango.hasta)),
  ])

  const ventasMismoMesHistorico: VentasHistoricasPorProducto = {}
  for (let index = 0; index < historicasRows.length; index += 1) {
    const anio = params.rangosMismoMesHistorico[index]?.anio
    if (!anio) continue
    acumularHistoricoPorAnio(
      historicasRows[index] ?? [],
      'cantidad',
      anio,
      ventasMismoMesHistorico
    )
  }

  return {
    ventasVentana: acumularVentas(ventasVentanaRows, 'cantidad'),
    ventasMesActual: acumularVentas(ventasMesActualRows, 'cantidad'),
    ventasMismoMesHistorico,
  }
}

export async function getSugeridoCompra(params?: {
  dias?: number
  lead_time?: number
  max_items?: number
  incluir_sin_movimiento?: boolean
}): Promise<SugeridoCompraResult> {
  const ventana_dias = Math.max(30, Math.min(params?.dias ?? 90, 365))
  const lead_time = Math.max(7, Math.min(params?.lead_time ?? 30, 120))
  const max_items = Math.max(50, Math.min(params?.max_items ?? 500, 2000))
  const incluir_sin_movimiento = Boolean(params?.incluir_sin_movimiento)

  return withReportCache('sugerido-compra', {
    ventana_dias,
    lead_time,
    max_items,
    incluir_sin_movimiento,
  }, async ({ supabase, session }) => {
    const hoy = new Date()
    const hasta = hoy.toISOString().slice(0, 10)

    const fechaDesde = new Date(hoy)
    fechaDesde.setDate(fechaDesde.getDate() - ventana_dias)
    const desde = fechaDesde.toISOString().slice(0, 10)

    const anioActual = hoy.getFullYear()
    const mesActual = hoy.getMonth() + 1
    const mesActualStr = String(mesActual).padStart(2, '0')
    const inicioMesActual = `${anioActual}-${mesActualStr}-01`
    const diasMesActual = new Date(anioActual, mesActual, 0).getDate()
    const diaActualMes = Math.max(1, hoy.getDate())
    const aniosAnteriores = [1, 2, 3].map((d) => anioActual - d)

    const rangosMismoMesHistorico = aniosAnteriores.map((anio) => ({
      anio,
      desde: `${anio}-${mesActualStr}-01`,
      hasta: `${anio}-${mesActualStr}-${String(new Date(anio, mesActual, 0).getDate()).padStart(2, '0')}`,
    }))

    const [
      productos,
      facturasVentaRes,
      lineasProductoRes,
      agregadosProductoRes,
    ] = await Promise.all([
      fetchAllRows<ProductoSugeridoRow>(async (from, to) => {
        const { data, error } = await supabase
          .from('productos')
          .select('id, codigo, descripcion, precio_compra, familia:familia_id(nombre), stock(cantidad, cantidad_minima)')
          .eq('empresa_id', session.empresa_id)
          .eq('activo', true)
          .order('descripcion')
          .range(from, to)

        if (error) throw error
        return (data ?? []) as ProductoSugeridoRow[]
      }),
      supabase
        .from('documentos')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', session.empresa_id)
        .eq('tipo', 'factura_venta')
        .neq('estado', 'cancelada'),
      supabase
        .from('documentos_lineas')
        .select('id, documento:documentos!inner(id)', { count: 'exact', head: true })
        .eq('documento.empresa_id', session.empresa_id)
        .eq('documento.tipo', 'factura_venta')
        .neq('documento.estado', 'cancelada')
        .not('producto_id', 'is', null),
      supabase
        .from('ventas_producto_diarias')
        .select('producto_id', { count: 'exact', head: true })
        .eq('empresa_id', session.empresa_id),
    ])

    if (facturasVentaRes.error) throw facturasVentaRes.error
    if (lineasProductoRes.error) throw lineasProductoRes.error
    if (agregadosProductoRes.error) throw agregadosProductoRes.error

    const diagnosticoBase = productos.reduce((acc, producto) => {
      const stocks = Array.isArray(producto.stock) ? producto.stock : []
      const stockActual = stocks.reduce((sum, stock) => sum + Number(stock.cantidad ?? 0), 0)
      const stockMinimo = stocks.reduce((sum, stock) => sum + Number(stock.cantidad_minima ?? 0), 0)

      if (stockActual < 0) acc.productos_con_stock_negativo += 1
      if (stockMinimo > 0) acc.productos_con_stock_minimo += 1
      if (stockActual < stockMinimo) acc.productos_bajo_minimo += 1

      return acc
    }, {
      productos_con_stock_negativo: 0,
      productos_con_stock_minimo: 0,
      productos_bajo_minimo: 0,
    })

    const diagnostico: SugeridoCompraDiagnostico = {
      facturas_venta: Number(facturasVentaRes.count ?? 0),
      lineas_producto: Number(lineasProductoRes.count ?? 0),
      agregados_producto: Number(agregadosProductoRes.count ?? 0),
      ...diagnosticoBase,
      sin_historial_producto:
        Number(facturasVentaRes.count ?? 0) > 0 &&
        Number(lineasProductoRes.count ?? 0) === 0 &&
        Number(agregadosProductoRes.count ?? 0) === 0,
    }

    if (!productos.length) {
      return { items: [], diagnostico }
    }

    const ventasParams = {
      supabase,
      empresaId: session.empresa_id,
      desde,
      hasta,
      inicioMesActual,
      rangosMismoMesHistorico,
    }

    let ventasData: {
      ventasVentana: VentasPorProducto
      ventasMesActual: VentasPorProducto
      ventasMismoMesHistorico: VentasHistoricasPorProducto
    }

    try {
      ventasData = await getVentasSugeridoDesdeAgregados(ventasParams)
    } catch (error) {
      if (!shouldFallbackToRaw(error)) throw error
      ventasData = await getVentasSugeridoDesdeLineas(ventasParams)
    }

    const items = construirSugeridosCompra({
      productos,
      ventasVentana: ventasData.ventasVentana,
      ventasMesActual: ventasData.ventasMesActual,
      ventasMismoMesHistorico: ventasData.ventasMismoMesHistorico,
      ventanaDias: ventana_dias,
      leadTime: lead_time,
      incluirSinMovimiento: incluir_sin_movimiento,
      sinHistorialProducto: diagnostico.sin_historial_producto,
      maxItems: max_items,
      diasMesActual,
      diaActualMes,
    })

    return { items, diagnostico }
  })
}
