export const dynamic = 'force-dynamic'

import { getAsientos } from '@/lib/db/contabilidad'
import { formatCOP, formatFecha } from '@/utils/cn'
import { BookOpen } from 'lucide-react'
import Link from 'next/link'
import { RevertirAsientoButton } from '@/components/contabilidad/RevertirAsientoButton'

const TIPOS_DOC = [
  { value: '', label: 'Todos los tipos' },
  { value: 'factura_venta', label: 'Factura venta' },
  { value: 'factura_compra', label: 'Factura compra' },
  { value: 'recibo_caja', label: 'Recibo de caja' },
  { value: 'recibo_compra', label: 'Recibo compra' },
  { value: 'nota_credito', label: 'Nota crédito' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'manual', label: 'Manual' },
]

interface PageProps {
  searchParams: Promise<{ desde?: string; hasta?: string; tipo_doc?: string }>
}

export default async function AsientosPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const hoy  = new Date().toISOString().split('T')[0]
  const anio = new Date().getFullYear()
  const desde    = sp.desde    || `${anio}-01-01`
  const hasta    = sp.hasta    || hoy
  const tipo_doc = sp.tipo_doc || ''

  const { asientos, total } = await getAsientos({
    limit: 200,
    desde,
    hasta,
    ...(tipo_doc ? { tipo_doc } : {}),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <BookOpen className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Libro de asientos</h1>
          <p className="text-sm text-gray-500">{total} asiento{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Link
          href="/contabilidad/asientos/nuevo"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nuevo asiento manual
        </Link>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Desde</label>
          <input type="date" name="desde" defaultValue={desde}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Hasta</label>
          <input type="date" name="hasta" defaultValue={hasta}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select name="tipo_doc" defaultValue={tipo_doc}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TIPOS_DOC.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">Aplicar</button>
          <Link href="/contabilidad/asientos" className="h-9 px-4 flex items-center rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50">Limpiar</Link>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        {asientos.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-10 text-center text-gray-400">
            No hay asientos contables
          </div>
        ) : asientos.map((a) => {
          const lineas = (a.lineas ?? []) as unknown as { id: string; descripcion?: string | null; debe: number; haber: number; cuenta?: { codigo: string; descripcion: string } | null }[]
          return (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-700">#{a.numero}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{a.tipo_doc ?? a.tipo}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-0.5">{a.concepto}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{formatFecha(a.fecha as string)}</p>
                  <p className="font-mono font-bold text-blue-700">{formatCOP(a.importe as number)}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 pt-3">
                {(a as { tipo?: string }).tipo === 'manual' && (
                  <Link
                    href={`/contabilidad/asientos/${a.id}/editar`}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Editar
                  </Link>
                )}
                {(a as { tipo?: string }).tipo === 'manual' && (
                  <RevertirAsientoButton
                    asientoId={a.id as string}
                    disabled={(a as { tipo_doc?: string }).tipo_doc === 'reversion_manual'}
                  />
                )}
              </div>
              {/* Líneas */}
              <div className="px-5 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="pb-1 text-left font-medium">Cuenta</th>
                      <th className="pb-1 text-left font-medium">Descripción</th>
                      <th className="pb-1 text-right font-medium">Débito</th>
                      <th className="pb-1 text-right font-medium">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {lineas.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 font-mono text-gray-500">
                          {(l.cuenta as { codigo?: string } | null)?.codigo ?? '—'}
                        </td>
                        <td className="py-1 text-gray-700">
                          {(l.cuenta as { descripcion?: string } | null)?.descripcion ?? l.descripcion ?? '—'}
                        </td>
                        <td className="py-1 text-right font-mono text-gray-800">{l.debe > 0 ? formatCOP(l.debe) : ''}</td>
                        <td className="py-1 text-right font-mono text-gray-800">{l.haber > 0 ? formatCOP(l.haber) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
