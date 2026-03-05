export const dynamic = 'force-dynamic'

import { getClientes, getGruposClientes, getEstadisticasClientes } from '@/lib/db/clientes'
import { ListaClientes } from '@/components/clientes/ListaClientes'
import { Users, UserCheck, CreditCard, UserX, Trophy, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/utils/cn'

interface PageProps {
  searchParams: Promise<{ q?: string; offset?: string; grupo_id?: string; tipo_documento?: string; tab?: string }>
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const sp            = await searchParams
  const tab           = sp.tab ?? 'lista'
  const busqueda      = sp.q ?? ''
  const offset        = parseInt(sp.offset ?? '0')
  const grupo_id      = sp.grupo_id
  const tipo_documento = sp.tipo_documento
  const limit         = 50

  const [{ clientes, total }, grupos, stats] = await Promise.all([
    getClientes({ busqueda, offset, limit, grupo_id, tipo_documento }),
    getGruposClientes(),
    getEstadisticasClientes(),
  ])

  // Datos para tabs adicionales
  const supabase = await createClient()
  let mejoresClientes: { id: string; razon_social: string; total_compras: number; num_facturas: number }[] = []
  let deudores: { id: string; razon_social: string; telefono: string | null; por_cobrar: number; facturas: number }[] = []

  if (tab === 'mejores') {
    const { data } = await supabase
      .from('documentos')
      .select('cliente_id, total, clientes(id, razon_social)')
      .eq('tipo', 'factura_venta')
      .neq('estado', 'cancelada')
      .not('cliente_id', 'is', null)

    const mapa: Record<string, { razon_social: string; total: number; count: number }> = {}
    for (const d of data ?? []) {
      const cid = d.cliente_id as string
      const cli = (Array.isArray(d.clientes) ? d.clientes[0] : d.clientes) as { id: string; razon_social: string } | null
      if (!cid || !cli) continue
      if (!mapa[cid]) mapa[cid] = { razon_social: cli.razon_social, total: 0, count: 0 }
      mapa[cid].total += d.total ?? 0
      mapa[cid].count += 1
    }
    mejoresClientes = Object.entries(mapa)
      .map(([id, v]) => ({ id, razon_social: v.razon_social, total_compras: v.total, num_facturas: v.count }))
      .sort((a, b) => b.total_compras - a.total_compras)
      .slice(0, 50)
  }

  if (tab === 'deudores') {
    const { data } = await supabase
      .from('documentos')
      .select('cliente_id, total, clientes(id, razon_social, telefono)')
      .eq('tipo', 'factura_venta')
      .eq('estado', 'pendiente')
      .not('cliente_id', 'is', null)

    const mapa: Record<string, { razon_social: string; telefono: string | null; total: number; count: number }> = {}
    for (const d of data ?? []) {
      const cid = d.cliente_id as string
      const cli = (Array.isArray(d.clientes) ? d.clientes[0] : d.clientes) as { id: string; razon_social: string; telefono: string | null } | null
      if (!cid || !cli) continue
      if (!mapa[cid]) mapa[cid] = { razon_social: cli.razon_social, telefono: cli.telefono ?? null, total: 0, count: 0 }
      mapa[cid].total += d.total ?? 0
      mapa[cid].count += 1
    }
    deudores = Object.entries(mapa)
      .map(([id, v]) => ({ id, razon_social: v.razon_social, telefono: v.telefono, por_cobrar: v.total, facturas: v.count }))
      .sort((a, b) => b.por_cobrar - a.por_cobrar)
  }

  const TABS = [
    { id: 'lista',    label: 'Lista',             href: '/clientes' },
    { id: 'mejores',  label: 'Mejores Clientes',  href: '/clientes?tab=mejores' },
    { id: 'deudores', label: 'Deudores',           href: '/clientes?tab=deudores' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Clientes</h2>
            <p className="text-sm text-gray-500">Gestión de clientes y grupos</p>
          </div>
        </div>
        <Link
          href="/clientes/grupos"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          Gestionar grupos →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',       valor: stats.total,      icon: Users,       color: 'bg-blue-50 text-blue-600' },
          { label: 'Activos',     valor: stats.activos,    icon: UserCheck,   color: 'bg-green-50 text-green-600' },
          { label: 'Con crédito', valor: stats.conCredito, icon: CreditCard,  color: 'bg-purple-50 text-purple-600' },
          { label: 'Inactivos',   valor: stats.inactivos,  icon: UserX,       color: 'bg-gray-50 text-gray-500' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <div className={`rounded-xl p-2.5 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.valor.toLocaleString('es-CO')}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(t => (
          <Link
            key={t.id}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white dark:bg-gray-900 border border-b-white dark:border-gray-700 dark:border-b-gray-900 text-blue-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Tab: Lista */}
      {tab === 'lista' && (
        <ListaClientes
          clientes={clientes}
          total={total}
          grupos={grupos}
          busqueda={busqueda}
          offset={offset}
          limit={limit}
          grupoFiltro={grupo_id ?? ''}
          tipoFiltro={tipo_documento ?? ''}
        />
      )}

      {/* Tab: Mejores Clientes */}
      {tab === 'mejores' && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-yellow-50 dark:bg-yellow-900/10">
            <Trophy className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-500">Top {mejoresClientes.length} clientes por volumen de compras</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-center font-medium text-gray-500 w-12">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Facturas</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total comprado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {mejoresClientes.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Sin datos de ventas</td></tr>
              ) : mejoresClientes.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-200 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'
                    }`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-blue-600 hover:underline">
                      {c.razon_social}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{c.num_facturas}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-700">{formatCOP(c.total_compras)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Deudores */}
      {tab === 'deudores' && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-red-50 dark:bg-red-900/10">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700 dark:text-red-400">
              {deudores.length} cliente{deudores.length !== 1 ? 's' : ''} con facturas pendientes
              {deudores.length > 0 && ` — Total: ${formatCOP(deudores.reduce((s, d) => s + d.por_cobrar, 0))}`}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Cliente</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Teléfono</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Facturas</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Por cobrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {deudores.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">Sin deudores — ¡excelente!</td></tr>
              ) : deudores.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${d.id}`} className="font-medium text-blue-600 hover:underline">
                      {d.razon_social}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{d.telefono ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {d.facturas}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-700">{formatCOP(d.por_cobrar)}</td>
                </tr>
              ))}
            </tbody>
            {deudores.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-700">
                <tr className="font-bold">
                  <td colSpan={3} className="px-4 py-3 text-gray-700 dark:text-gray-300">TOTAL POR COBRAR</td>
                  <td className="px-4 py-3 text-right font-mono text-red-700">
                    {formatCOP(deudores.reduce((s, d) => s + d.por_cobrar, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
