export const dynamic = 'force-dynamic'

import { getCuentasPUC } from '@/lib/db/contabilidad'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { cn, cardCls } from '@/utils/cn'

interface PageProps {
  searchParams: Promise<{ q?: string; nivel?: string }>
}

const TIPO_COLOR: Record<string, string> = {
  activo:     'bg-green-100 text-green-700',
  pasivo:     'bg-red-100 text-red-700',
  patrimonio: 'bg-purple-100 text-purple-700',
  ingreso:    'bg-blue-100 text-blue-700',
  gasto:      'bg-orange-100 text-orange-700',
  costo:      'bg-yellow-100 text-yellow-700',
}

const NIVEL_INDENT: Record<number, string> = {
  1: 'font-bold text-gray-900 dark:text-gray-100',
  2: 'pl-4 font-semibold text-gray-800 dark:text-gray-200',
  3: 'pl-8 text-gray-700 dark:text-gray-300',
  4: 'pl-12 text-gray-600 dark:text-gray-400 dark:text-gray-500',
  5: 'pl-16 text-gray-500 dark:text-gray-400 dark:text-gray-500',
}

export default async function CuentasPage({ searchParams }: PageProps) {
  const { q, nivel } = await searchParams
  const nivelNum = nivel ? parseInt(nivel) : undefined
  const { cuentas, total } = await getCuentasPUC({ busqueda: q, nivel: nivelNum })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <BookOpen className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Plan Único de Cuentas (PUC)</h1>
          <p className="text-sm text-gray-500">{total} cuenta{total !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Link
          href="/contabilidad/cuentas/nueva"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nueva cuenta
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por código o descripción..."
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          name="nivel"
          defaultValue={nivel ?? ''}
          className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos los niveles</option>
          <option value="1">Nivel 1 — Clase</option>
          <option value="2">Nivel 2 — Grupo</option>
          <option value="3">Nivel 3 — Cuenta</option>
          <option value="4">Nivel 4 — Subcuenta</option>
        </select>
        <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors">Buscar</button>
        {(q || nivel) && (
          <a href="/contabilidad/cuentas" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</a>
        )}
      </form>

      {/* Tabla */}
      <div className={cn(cardCls, 'overflow-hidden')}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Código</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Descripción</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Naturaleza</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cuentas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No hay cuentas</td></tr>
            ) : cuentas.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2 font-mono text-gray-700">{c.codigo}</td>
                <td className={`px-4 py-2 ${NIVEL_INDENT[c.nivel ?? 4] ?? 'text-gray-600 dark:text-gray-400 dark:text-gray-500'}`}>{c.descripcion}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo ?? ''] ?? 'bg-gray-100 text-gray-600 dark:text-gray-400 dark:text-gray-500'}`}>
                    {c.tipo}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs font-medium ${(c as any).naturaleza === 'debito' ? 'text-blue-600' : 'text-red-600'}`}>
                    {(c as any).naturaleza === 'debito' ? 'Débito' : 'Crédito'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`inline-flex h-2 w-2 rounded-full ${(c as any).activa !== false ? 'bg-green-500' : 'bg-gray-300'}`} />
                </td>
                <td className="px-4 py-2 text-center">
                  <Link
                    href={`/contabilidad/cuentas/${c.id}/editar`}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
