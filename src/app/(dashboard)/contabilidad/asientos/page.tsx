export const dynamic = 'force-dynamic'

import { getAsientos } from '@/lib/db/contabilidad'
import { formatCOP, formatFecha } from '@/utils/cn'
import { BookOpen } from 'lucide-react'

export default async function AsientosPage() {
  const { asientos, total } = await getAsientos({ limit: 100 })

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

      <div className="flex flex-col gap-4">
        {asientos.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
            No hay asientos contables
          </div>
        ) : asientos.map((a) => {
          const lineas = (a.lineas ?? []) as unknown as { id: string; descripcion?: string | null; debe: number; haber: number; cuenta?: { codigo: string; descripcion: string } | null }[]
          return (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white">
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
