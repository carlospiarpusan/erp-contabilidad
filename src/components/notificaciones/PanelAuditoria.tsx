'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'

interface AuditItem {
  id: string
  tabla: string
  registro_id?: string | null
  accion: string
  usuario_id?: string | null
  created_at: string
}

export function PanelAuditoria() {
  const [items, setItems] = useState<AuditItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tabla, setTabla] = useState('')
  const [accion, setAccion] = useState('')

  const cargar = useCallback(async (filtros?: { tabla?: string; accion?: string }) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      const tablaFilter = filtros?.tabla ?? ''
      const accionFilter = filtros?.accion ?? ''
      if (tablaFilter.trim()) params.set('tabla', tablaFilter.trim())
      if (accionFilter.trim()) params.set('accion', accionFilter.trim())
      params.set('limit', '150')
      const res = await fetch(`/api/auditoria?${params.toString()}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'No se pudo cargar auditoría')
      setItems(body.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando auditoría')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Tabla</label>
            <input
              value={tabla}
              onChange={(e) => setTabla(e.target.value)}
              placeholder="documentos, asientos, cuentas_puc..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Acción</label>
            <select
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => void cargar({ tabla, accion })}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
          <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" /> Cargando auditoría...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          Sin movimientos en auditoría para los filtros seleccionados.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tabla</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Registro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 text-gray-600">{new Date(i.created_at).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{i.tabla}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {i.accion}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{i.registro_id ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{i.usuario_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
        <ShieldCheck className="mr-1 inline-block h-4 w-4" />
        La auditoría registra altas, cambios y anulaciones ejecutadas desde el sistema.
      </div>
    </div>
  )
}
