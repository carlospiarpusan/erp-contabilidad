export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ estado?: string }>
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  pendiente:  'warning',
  en_proceso: 'info',
  resuelta:   'success',
  rechazada:  'danger',
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja:   'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500',
  normal: 'bg-blue-100 text-blue-700',
  alta:   'bg-orange-100 text-orange-700',
  urgente:'bg-red-100 text-red-700',
}

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'pendiente',  label: 'Pendiente' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'resuelta',   label: 'Resuelta' },
  { key: 'rechazada',  label: 'Rechazada' },
]

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export default async function GarantiasPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const estado = sp.estado || ''

  const supabase = await createClient()
  let q = supabase
    .from('garantias')
    .select('id, numero, estado, prioridad, numero_serie, numero_rma, fecha_venta, observaciones, created_at, cliente:cliente_id(razon_social), producto:producto_id(descripcion, codigo)', { count: 'exact' })
    .eq('empresa_id', EMPRESA_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) q = q.eq('estado', estado)
  const { data, count } = await q
  const garantias = data ?? []

  const stats = {
    pendiente:  garantias.filter(g => g.estado === 'pendiente').length,
    en_proceso: garantias.filter(g => g.estado === 'en_proceso').length,
    resuelta:   garantias.filter(g => g.estado === 'resuelta').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Garantías y Devoluciones</h1>
            <p className="text-sm text-gray-500">{count ?? 0} registro{(count ?? 0) !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/ventas/garantias/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva garantía
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600 mt-0.5">{stats.pendiente}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">En proceso</p>
          <p className="text-2xl font-bold text-blue-600 mt-0.5">{stats.en_proceso}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Resueltas</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{stats.resuelta}</p>
        </div>
      </div>

      {/* Tabs + tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex gap-1 p-2 border-b border-gray-100">
          {TABS.map(t => (
            <Link key={t.key} href={t.key ? `/ventas/garantias?estado=${t.key}` : '/ventas/garantias'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                estado === t.key ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
              }`}>
              {t.label}
            </Link>
          ))}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">N°</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Serie / RMA</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha venta</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Prioridad</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {garantias.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No hay garantías.{' '}
                  <Link href="/ventas/garantias/nueva" className="text-emerald-600 hover:underline">Registrar primera</Link>
                </td>
              </tr>
            ) : garantias.map(g => {
              const cli  = (g as never).cliente  as { razon_social?: string } | null
              const prod = (g as never).producto as { descripcion?: string; codigo?: string } | null
              return (
                <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => window.location.href=`/ventas/garantias/${g.id}`}>
                  <td className="px-4 py-3 font-mono text-emerald-600 font-medium">{g.numero}</td>
                  <td className="px-4 py-3 text-gray-800">{cli?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-800">{prod?.descripcion ?? '—'}</p>
                    {prod?.codigo && <p className="text-xs text-gray-400 font-mono">{prod.codigo}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {g.numero_serie ?? g.numero_rma ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{g.fecha_venta ? formatFecha(g.fecha_venta) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLOR[g.prioridad ?? 'normal'] ?? 'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500'}`}>
                      {g.prioridad ?? 'normal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={BADGE_ESTADO[g.estado] ?? 'outline'}>{g.estado}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
