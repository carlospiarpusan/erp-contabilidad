import { createClient } from '@/lib/supabase/server'
import type { KPIs, ResumenMes } from '@/types'

export async function getKPIs(año?: number): Promise<KPIs> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_kpis_dashboard', {
    p_empresa_id: await getEmpresaId(supabase),
    p_año: año ?? new Date().getFullYear(),
  })

  if (error) {
    // Fallback con datos reales desde la tabla
    return getFallbackKPIs(supabase, año)
  }
  return data as KPIs
}

export async function getResumenMensual(año?: number): Promise<ResumenMes[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_resumen_mensual', {
    p_empresa_id: await getEmpresaId(supabase),
    p_año: año ?? new Date().getFullYear(),
  })

  if (error) throw error
  return (data ?? []) as ResumenMes[]
}

export async function getUltimasFacturas(limit = 8) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, fecha, total, estado,
      cliente:clientes(id, razon_social)
    `)
    .eq('tipo', 'factura_venta')
    .neq('estado', 'cancelada')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getAlertasStock(limit = 5) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('stock_bajo')
    .select('*')
    .order('cantidad')
    .limit(limit)

  if (error) return []
  return data ?? []
}

export async function getFacturasVencidas(limit = 5) {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('documentos')
    .select(`
      id, numero, prefijo, total, fecha_vencimiento,
      cliente:clientes(razon_social)
    `)
    .eq('tipo', 'factura_venta')
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy)
    .order('fecha_vencimiento')
    .limit(limit)

  if (error) return []
  return data ?? []
}

// ── helpers internos ─────────────────────────────────────────

async function getEmpresaId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data } = await supabase
    .from('usuarios')
    .select('empresa_id')
    .eq('id', user.id)
    .single()

  return data?.empresa_id
}

async function getFallbackKPIs(supabase: Awaited<ReturnType<typeof createClient>>, año?: number): Promise<KPIs> {
  const { data } = await supabase
    .from('documentos')
    .select('total, total_costo, estado')
    .eq('tipo', 'factura_venta')
    .neq('estado', 'cancelada')

  const rows = data ?? []
  const total_facturado = rows.reduce((s, r) => s + (r.total ?? 0), 0)
  const costos_ventas = rows.reduce((s, r) => s + (r.total_costo ?? 0), 0)
  const ganancias = total_facturado - costos_ventas
  const facturas_activas = rows.filter(r => r.estado === 'pendiente').length

  return {
    facturas_activas,
    total_facturado,
    costos_ventas,
    ganancias,
    margen_porcentaje: total_facturado > 0
      ? Math.round((ganancias / total_facturado) * 10000) / 100
      : 0,
  }
}
