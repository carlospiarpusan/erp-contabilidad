'use client'

import { useState, useEffect } from 'react'
import { Zap, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn, cardCls } from '@/utils/cn'

interface Pendiente { tipo: string; pendientes: number }
interface Generado  { tipo: string; documento: string; asiento_id: string }
interface ResumenGeneracion {
  total_antes: number
  total_restantes: number
  warning: string | null
}

export default function AsientosMasivoPage() {
  const [pendientes, setPendientes]   = useState<Pendiente[]>([])
  const [cargando, setCargando]       = useState(true)
  const [generando, setGenerando]     = useState(false)
  const [generados, setGenerados]     = useState<Generado[] | null>(null)
  const [resumen, setResumen]         = useState<ResumenGeneracion | null>(null)
  const [error, setError]             = useState<string | null>(null)

  async function cargarPendientes() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/asientos-masivo')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPendientes(data.pendientes ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setCargando(false)
    }
  }

  async function generarAsientos() {
    setGenerando(true)
    setError(null)
    setGenerados(null)
    setResumen(null)
    try {
      const res = await fetch('/api/contabilidad/asientos-masivo', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGenerados(data.generados ?? [])
      setResumen({
        total_antes: data.total_antes ?? 0,
        total_restantes: data.total_restantes ?? 0,
        warning: data.warning ?? null,
      })
      await cargarPendientes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGenerando(false)
    }
  }

  useEffect(() => { cargarPendientes() }, [])

  const totalPendientes = pendientes.reduce((s, p) => s + (p.pendientes ?? 0), 0)

  const LABELS: Record<string, string> = {
    facturas_venta:  'Facturas de Venta',
    recibos_caja:    'Recibos de Caja',
    facturas_compra: 'Facturas de Compra',
  }

  const TIPOS_GENERADO: Record<string, string> = {
    factura_venta:  'FV',
    recibo_venta:   'RC',
    factura_compra: 'FC',
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <Zap className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Generar Asientos Automáticos</h1>
          <p className="text-sm text-gray-500">Genera asientos contables para documentos que no los tienen</p>
        </div>
      </div>

      {/* Estado pendientes */}
      <div className={cn(cardCls, 'p-5')}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documentos sin asiento contable</h2>
          <button onClick={cargarPendientes} disabled={cargando}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando...
          </div>
        ) : (
          <div className="space-y-3">
            {pendientes.map(p => (
              <div key={p.tipo} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-300">{LABELS[p.tipo] ?? p.tipo}</span>
                <span className={`font-bold font-mono text-sm px-2.5 py-0.5 rounded-full ${
                  p.pendientes > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {p.pendientes > 0 ? `${p.pendientes} pendientes` : '✓ Al día'}
                </span>
              </div>
            ))}
            {pendientes.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No hay datos. Verifica la configuración.</p>
            )}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          {totalPendientes > 0 ? (
            <p className="text-sm text-amber-600 font-medium">
              {totalPendientes} documento{totalPendientes !== 1 ? 's' : ''} sin contabilizar
            </p>
          ) : (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Todos los documentos tienen asiento
            </p>
          )}

          <button
            onClick={generarAsientos}
            disabled={generando || totalPendientes === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {generando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generando...</>
              : <><Zap className="h-4 w-4" /> Generar {totalPendientes > 0 ? `${totalPendientes} asientos` : 'asientos'}</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error al generar asientos</p>
            <p>{error}</p>
            <p className="text-xs mt-1 text-red-500">Verifica que las cuentas especiales estén configuradas en Contabilidad → Cuentas Especiales.</p>
          </div>
        </div>
      )}

      {/* Resultados */}
      {generados !== null && (
        <div className={cn(cardCls, 'p-5')}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {generados.length} asiento{generados.length !== 1 ? 's' : ''} generados correctamente
            </h2>
          </div>

          {resumen?.warning && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {resumen.warning}
            </div>
          )}

          {generados.length > 0 ? (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-500">Tipo</th>
                    <th className="px-3 py-2 text-left text-gray-500">Documento</th>
                    <th className="px-3 py-2 text-left text-gray-500">Asiento ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {generados.map((g, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-3 py-1.5">
                        <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                          {TIPOS_GENERADO[g.tipo] ?? g.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300">{g.documento}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-400 text-xs">{g.asiento_id?.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No había documentos pendientes.</p>
          )}

          {resumen && (
            <p className="mt-4 text-xs text-gray-500">
              Pendientes antes: {resumen.total_antes} · Pendientes restantes: {resumen.total_restantes}
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-900/30 p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-medium mb-1">¿Cuándo usar esto?</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Después de importar facturas o recibos históricos desde CSV</li>
          <li>Si hubo un error durante la creación de un documento</li>
          <li>Para sincronizar documentos creados antes de la configuración contable</li>
        </ul>
      </div>
    </div>
  )
}
