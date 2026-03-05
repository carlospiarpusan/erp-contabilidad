export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Wrench, Plus } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ estado?: string }>
}

const BADGE_ESTADO: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info'> = {
  recibida:    'outline',
  diagnostico: 'warning',
  en_proceso:  'info',
  listo:       'default',
  entregado:   'success',
  cancelado:   'danger',
}

const PRIORIDAD_COLOR: Record<string, string> = {
  baja:   'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500',
  normal: 'bg-blue-100 text-blue-700',
  alta:   'bg-orange-100 text-orange-700',
  urgente:'bg-red-100 text-red-700',
}

const TABS = [
  { key: '',           label: 'Todas' },
  { key: 'recibida',   label: 'Recibida' },
  { key: 'diagnostico',label: 'Diagnóstico' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'listo',      label: 'Listo' },
  { key: 'entregado',  label: 'Entregado' },
]

const EMPRESA_ID = '00000000-0000-0000-0000-000000000001'

export default async function ServiciosPage({ searchParams }: PageProps) {
  const sp     = await searchParams
  const estado = sp.estado || ''

  const supabase = await createClient()
  let q = supabase
    .from('servicios_tecnicos')
    .select('id, numero, tipo, estado, servicio, prioridad, fecha_inicio, fecha_promesa, fecha_cierre, created_at, cliente:cliente_id(razon_social)', { count: 'exact' })
    .eq('empresa_id', EMPRESA_ID)
    .order('created_at', { ascending: false })
    .limit(100)

  if (estado) q = q.eq('estado', estado)
  const { data, count } = await q
  const servicios = data ?? []

  const stats = {
    recibidas:   servicios.filter(s => s.estado === 'recibida').length,
    en_proceso:  servicios.filter(s => s.estado === 'en_proceso' || s.estado === 'diagnostico').length,
    listos:      servicios.filter(s => s.estado === 'listo').length,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Wrench className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Servicio Técnico</h1>
            <p className="text-sm text-gray-500">{count ?? 0} orden{(count ?? 0) !== 1 ? 'es' : ''}</p>
          </div>
        </div>
        <Link href="/ventas/servicios/nueva"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva orden
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Recibidas</p>
          <p className="text-2xl font-bold text-gray-700 mt-0.5">{stats.recibidas}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">En proceso</p>
          <p className="text-2xl font-bold text-blue-600 mt-0.5">{stats.en_proceso}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
          <p className="text-xs text-gray-500">Listos para entrega</p>
          <p className="text-2xl font-bold text-violet-600 mt-0.5">{stats.listos}</p>
        </div>
      </div>

      {/* Tabs + tabla */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100">
          {TABS.map(t => (
            <Link key={t.key} href={t.key ? `/ventas/servicios?estado=${t.key}` : '/ventas/servicios'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                estado === t.key ? 'bg-violet-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
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
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Servicio</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha inicio</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Fecha promesa</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Prioridad</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {servicios.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No hay órdenes de servicio.{' '}
                  <Link href="/ventas/servicios/nueva" className="text-violet-600 hover:underline">Crear primera orden</Link>
                </td>
              </tr>
            ) : servicios.map(s => {
              const cli = (s as never).cliente as { razon_social?: string } | null
              return (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => window.location.href=`/ventas/servicios/${s.id}`}>
                  <td className="px-4 py-3 font-mono text-violet-600 font-medium">{s.numero}</td>
                  <td className="px-4 py-3 text-gray-800">{cli?.razon_social ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{s.servicio ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs capitalize">{s.tipo ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.fecha_inicio ? formatFecha(s.fecha_inicio) : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.fecha_promesa ? formatFecha(s.fecha_promesa) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLOR[s.prioridad ?? 'normal'] ?? 'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500'}`}>
                      {s.prioridad ?? 'normal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={BADGE_ESTADO[s.estado] ?? 'outline'}>{s.estado?.replace('_', ' ')}</Badge>
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
