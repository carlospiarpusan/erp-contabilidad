export const dynamic = 'force-dynamic'

import { getClientes, getGruposClientes, getEstadisticasClientes } from '@/lib/db/clientes'
import { ListaClientes } from '@/components/clientes/ListaClientes'
import { Users, UserCheck, CreditCard, UserX } from 'lucide-react'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ q?: string; offset?: string; grupo_id?: string; tipo_documento?: string }>
}

export default async function ClientesPage({ searchParams }: PageProps) {
  const sp            = await searchParams
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

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
            <p className="text-sm text-gray-500">Gestión de clientes y grupos</p>
          </div>
        </div>
        <Link
          href="/clientes/grupos"
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          Gestionar grupos →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total',          valor: stats.total,      icon: Users,       color: 'bg-blue-50 text-blue-600' },
          { label: 'Activos',        valor: stats.activos,    icon: UserCheck,   color: 'bg-green-50 text-green-600' },
          { label: 'Con crédito',    valor: stats.conCredito, icon: CreditCard,  color: 'bg-purple-50 text-purple-600' },
          { label: 'Inactivos',      valor: stats.inactivos,  icon: UserX,       color: 'bg-gray-50 text-gray-500 dark:text-gray-400 dark:text-gray-500' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
            <div className={`rounded-xl p-2.5 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.valor.toLocaleString('es-CO')}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lista */}
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
    </div>
  )
}
