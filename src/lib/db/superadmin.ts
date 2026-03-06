import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

const EMPRESA_BASE = '00000000-0000-0000-0000-000000000001'

export interface SuperadminEmpresa {
  id: string
  nombre: string
  nit: string
  activa: boolean
  created_at: string | null
  total_ventas: number
  total_usuarios: number
  total_documentos: number
}

export interface SuperadminStats {
  totalEmpresas: number
  totalUsuarios: number
  totalVentas: number
  totalCompras: number
  totalGastos: number
  totalFacturas: number
  totalComprasDocs: number
  ventasMes: number
  comprasMes: number
  empresas: SuperadminEmpresa[]
}

function emptyStats(): SuperadminStats {
  return {
    totalEmpresas: 0,
    totalUsuarios: 0,
    totalVentas: 0,
    totalCompras: 0,
    totalGastos: 0,
    totalFacturas: 0,
    totalComprasDocs: 0,
    ventasMes: 0,
    comprasMes: 0,
    empresas: [],
  }
}

function toNumber(value: unknown): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function normalizeEmpresas(value: unknown): SuperadminEmpresa[] {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      const item = (row && typeof row === 'object')
        ? row as Record<string, unknown>
        : {}
      const id = typeof item.id === 'string' ? item.id : ''
      if (!id) return null
      return {
        id,
        nombre: typeof item.nombre === 'string' ? item.nombre : 'Empresa',
        nit: typeof item.nit === 'string' ? item.nit : '',
        activa: Boolean(item.activa),
        created_at: typeof item.created_at === 'string' ? item.created_at : null,
        total_ventas: toNumber(item.total_ventas),
        total_usuarios: toNumber(item.total_usuarios),
        total_documentos: toNumber(item.total_documentos),
      }
    })
    .filter((row): row is SuperadminEmpresa => Boolean(row))
}

function normalizeStats(value: unknown): SuperadminStats {
  if (!value || typeof value !== 'object') return emptyStats()
  const raw = value as Record<string, unknown>
  return {
    totalEmpresas: toNumber(raw.totalEmpresas),
    totalUsuarios: toNumber(raw.totalUsuarios),
    totalVentas: toNumber(raw.totalVentas),
    totalCompras: toNumber(raw.totalCompras),
    totalGastos: toNumber(raw.totalGastos),
    totalFacturas: toNumber(raw.totalFacturas),
    totalComprasDocs: toNumber(raw.totalComprasDocs),
    ventasMes: toNumber(raw.ventasMes),
    comprasMes: toNumber(raw.comprasMes),
    empresas: normalizeEmpresas(raw.empresas),
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for superadmin')
  }
  return createClient(
    url,
    serviceRole,
  )
}

async function getFallbackStats(admin: SupabaseClient): Promise<SuperadminStats> {
  const [
    { count: totalEmpresas },
    { count: totalUsuarios },
    { count: totalFacturas },
    { count: totalComprasDocs },
    { data: empresas },
    { data: usuarios },
  ] = await Promise.all([
    admin.from('empresas').select('*', { count: 'exact', head: true }).neq('nit', '00000000'),
    admin.from('usuarios').select('*', { count: 'exact', head: true }),
    admin.from('documentos').select('*', { count: 'exact', head: true }).eq('tipo', 'factura_venta').neq('empresa_id', EMPRESA_BASE),
    admin.from('documentos').select('*', { count: 'exact', head: true }).eq('tipo', 'factura_compra').neq('empresa_id', EMPRESA_BASE),
    admin.from('empresas').select('id, nombre, nit, activa, created_at').neq('nit', '00000000').order('created_at', { ascending: false }),
    admin.from('usuarios').select('empresa_id'),
  ])

  const usuariosPorEmpresa: Record<string, number> = {}
  for (const u of usuarios ?? []) {
    usuariosPorEmpresa[u.empresa_id] = (usuariosPorEmpresa[u.empresa_id] ?? 0) + 1
  }

  return {
    totalEmpresas: totalEmpresas ?? 0,
    totalUsuarios: totalUsuarios ?? 0,
    totalVentas: 0,
    totalCompras: 0,
    totalGastos: 0,
    totalFacturas: totalFacturas ?? 0,
    totalComprasDocs: totalComprasDocs ?? 0,
    ventasMes: 0,
    comprasMes: 0,
    empresas: (empresas ?? []).map((e) => ({
      id: e.id,
      nombre: e.nombre,
      nit: e.nit,
      activa: e.activa,
      created_at: e.created_at,
      total_ventas: 0,
      total_usuarios: usuariosPorEmpresa[e.id] ?? 0,
      total_documentos: 0,
    })),
  }
}

export const getEstadisticasGlobales = unstable_cache(async () => {
  try {
    const admin = adminClient()
    const { data, error } = await admin.rpc('get_superadmin_estadisticas')
    if (!error && data) {
      return normalizeStats(data)
    }
    return await getFallbackStats(admin)
  } catch {
    return emptyStats()
  }
}, ['superadmin-stats'], { revalidate: 120 })
