import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function getEstadisticasGlobales() {
  const admin = adminClient()

  const [
    { count: totalEmpresas },
    { count: totalUsuarios },
    { data: docs },
    { data: empresas },
  ] = await Promise.all([
    admin.from('empresas').select('*', { count: 'exact', head: true }).neq('nit', '00000000'),
    admin.from('usuarios').select('*', { count: 'exact', head: true }),
    admin.from('documentos').select('tipo, total, fecha, empresa_id').neq('empresa_id', '00000000-0000-0000-0000-000000000001'),
    admin.from('empresas').select('id, nombre, nit, activa, created_at').neq('nit', '00000000').order('created_at', { ascending: false }),
  ])

  const ventas   = (docs ?? []).filter(d => d.tipo === 'factura_venta')
  const compras  = (docs ?? []).filter(d => d.tipo === 'factura_compra')
  const gastos   = (docs ?? []).filter(d => d.tipo === 'gasto')

  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`

  const sumar = (rows: { total?: number | null }[]) =>
    rows.reduce((s, r) => s + (r.total ?? 0), 0)

  const ventasMes   = ventas.filter(d => (d.fecha ?? '') >= inicioMes)
  const comprasMes  = compras.filter(d => (d.fecha ?? '') >= inicioMes)

  // Ventas por empresa (top 5)
  const ventasPorEmpresa: Record<string, number> = {}
  for (const d of ventas) {
    ventasPorEmpresa[d.empresa_id] = (ventasPorEmpresa[d.empresa_id] ?? 0) + (d.total ?? 0)
  }

  // Usuarios por empresa
  const { data: usuariosAll } = await admin.from('usuarios').select('empresa_id, activo')
  const usuariosPorEmpresa: Record<string, number> = {}
  for (const u of usuariosAll ?? []) {
    usuariosPorEmpresa[u.empresa_id] = (usuariosPorEmpresa[u.empresa_id] ?? 0) + 1
  }

  const empresasDetalle = (empresas ?? []).map(e => ({
    ...e,
    total_ventas: ventasPorEmpresa[e.id] ?? 0,
    total_usuarios: usuariosPorEmpresa[e.id] ?? 0,
    total_documentos: (docs ?? []).filter(d => d.empresa_id === e.id).length,
  }))

  return {
    totalEmpresas:    totalEmpresas ?? 0,
    totalUsuarios:    totalUsuarios ?? 0,
    totalVentas:      sumar(ventas),
    totalCompras:     sumar(compras),
    totalGastos:      sumar(gastos),
    totalFacturas:    ventas.length,
    totalComprasDocs: compras.length,
    ventasMes:        sumar(ventasMes),
    comprasMes:       sumar(comprasMes),
    empresas:         empresasDetalle,
  }
}
