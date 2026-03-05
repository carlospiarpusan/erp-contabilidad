'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Save } from 'lucide-react'

interface Tipo { tipo: string; label: string; desc: string }
interface Cuenta { id: string; codigo: string; descripcion: string; nivel: number }
interface Especial { id?: string; tipo: string; cuenta_id: string; cuentas_puc?: { id: string; codigo: string; descripcion: string } | null }

interface Props {
  tipos: Tipo[]
  mapaActual: Record<string, Especial>
  cuentas: Cuenta[]
}

export function FormCuentasEspeciales({ tipos, mapaActual, cuentas }: Props) {
  const router = useRouter()
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(tipos.map(t => [t.tipo, mapaActual[t.tipo]?.cuenta_id ?? '']))
  )
  const [guardando, setGuardando] = useState<string | null>(null)
  const [guardados, setGuardados] = useState<Set<string>>(new Set())

  async function guardar(tipo: string) {
    const cuenta_id = valores[tipo]
    if (!cuenta_id) return
    setGuardando(tipo)
    try {
      const res = await fetch('/api/contabilidad/cuentas-especiales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, cuenta_id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setGuardados(prev => new Set([...prev, tipo]))
      setTimeout(() => {
        setGuardados(prev => { const s = new Set(prev); s.delete(tipo); return s })
        router.refresh()
      }, 1500)
    } catch (e: any) { alert(e.message) }
    finally { setGuardando(null) }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-violet-50 dark:bg-violet-900/10">
        <p className="text-xs text-violet-700 dark:text-violet-400">
          Estas cuentas se usan automáticamente al generar asientos contables. Asigna cuentas del nivel 4 (subcuentas).
        </p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500 w-40">Función</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Descripción</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Cuenta actual</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Asignar cuenta</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {tipos.map(t => {
            const actual = mapaActual[t.tipo]
            const cuenta = actual?.cuentas_puc
            const changed = valores[t.tipo] !== (actual?.cuenta_id ?? '')
            const saved   = guardados.has(t.tipo)

            return (
              <tr key={t.tipo} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">{t.label}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.desc}</td>
                <td className="px-4 py-3">
                  {cuenta ? (
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {cuenta.codigo} — {cuenta.descripcion}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={valores[t.tipo]}
                    onChange={e => setValores(p => ({ ...p, [t.tipo]: e.target.value }))}
                    className="w-full h-8 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">— Seleccionar cuenta —</option>
                    {cuentas.map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} — {c.descripcion}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  {saved ? (
                    <span className="flex items-center gap-1 text-green-600 text-xs"><Check className="h-3.5 w-3.5" /> Guardado</span>
                  ) : (
                    <button
                      onClick={() => guardar(t.tipo)}
                      disabled={!changed || guardando === t.tipo || !valores[t.tipo]}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save className="h-3 w-3" />
                      {guardando === t.tipo ? 'Guardando…' : 'Guardar'}
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
