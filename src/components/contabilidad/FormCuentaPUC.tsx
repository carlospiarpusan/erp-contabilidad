'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cardCls } from '@/utils/cn'

type CuentaPadre = {
  id: string
  codigo: string
  descripcion: string
}

interface Props {
  inicial?: {
    id?: string
    codigo: string
    descripcion: string
    tipo: string
    nivel: number
    naturaleza: 'debito' | 'credito'
    cuenta_padre_id?: string | null
    activa?: boolean
  }
  cuentasPadre: CuentaPadre[]
}

const TIPOS = ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo']

export function FormCuentaPUC({ inicial, cuentasPadre }: Props) {
  const router = useRouter()
  const [codigo, setCodigo] = useState(inicial?.codigo ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'activo')
  const [nivel, setNivel] = useState(inicial?.nivel ?? 4)
  const [naturaleza, setNaturaleza] = useState<'debito' | 'credito'>(inicial?.naturaleza ?? 'debito')
  const [cuentaPadreId, setCuentaPadreId] = useState(inicial?.cuenta_padre_id ?? '')
  const [activa, setActiva] = useState(inicial?.activa ?? true)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!codigo.trim() || !descripcion.trim()) {
      setError('Código y descripción son requeridos')
      return
    }

    setGuardando(true)
    try {
      const payload = {
        codigo: codigo.trim(),
        descripcion: descripcion.trim(),
        tipo,
        nivel: Number(nivel),
        naturaleza,
        cuenta_padre_id: cuentaPadreId || null,
        activa,
      }

      const res = await fetch(
        inicial?.id ? `/api/contabilidad/cuentas/${inicial.id}` : '/api/contabilidad/cuentas',
        {
          method: inicial?.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? 'No se pudo guardar la cuenta')
      router.push('/contabilidad/cuentas')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando la cuenta')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className={`max-w-2xl ${cardCls} p-5`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Código *</label>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ej: 110505"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nivel *</label>
          <input
            type="number"
            min={1}
            max={5}
            value={nivel}
            onChange={(e) => setNivel(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">Descripción *</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descripción de la cuenta"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Naturaleza *</label>
          <select
            value={naturaleza}
            onChange={(e) => setNaturaleza(e.target.value as 'debito' | 'credito')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="debito">Débito</option>
            <option value="credito">Crédito</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">Cuenta padre</label>
          <select
            value={cuentaPadreId}
            onChange={(e) => setCuentaPadreId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin cuenta padre</option>
            {cuentasPadre.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} - {c.descripcion}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Cuenta activa
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push('/contabilidad/cuentas')}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : inicial?.id ? 'Guardar cambios' : 'Crear cuenta'}
        </Button>
      </div>
    </form>
  )
}
