'use client'

import { calcularRetencionesSeleccionadas, type RetencionDefinition, type RetencionSelection } from '@/lib/accounting/retenciones'
import { formatCOP } from '@/utils/cn'

interface Props {
  retenciones: RetencionDefinition[]
  value: RetencionSelection[]
  base: number
  uvtValue?: number | null
  onChange: (value: RetencionSelection[]) => void
}

const boxCls = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'

export function RetencionesSelector({ retenciones, value, base, uvtValue, onChange }: Props) {
  if (retenciones.length === 0) return null

  const toggle = (retencionId: string) => {
    const exists = value.some((item) => item.retencion_id === retencionId)
    if (exists) {
      onChange(value.filter((item) => item.retencion_id !== retencionId))
      return
    }
    onChange([...value, { retencion_id: retencionId }])
  }

  const selected = calcularRetencionesSeleccionadas({
    selections: value.map((item) => ({ ...item, base_gravable: item.base_gravable ?? base })),
    definitions: retenciones,
    defaultBase: base,
    uvtValue,
  })

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Retenciones</p>
        <p className="mt-1 text-sm text-gray-500">
          Selecciona las retenciones que apliquen. El sistema descuenta el valor retenido del desembolso y lo deja contabilizado por separado.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {retenciones.map((retencion) => {
          const active = value.some((item) => item.retencion_id === retencion.id)
          return (
            <label
              key={retencion.id}
              className={`${boxCls} flex cursor-pointer items-start gap-3 ${active ? 'border-teal-500 ring-1 ring-teal-500/30' : ''}`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(retencion.id)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{retencion.nombre}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {retencion.tipo}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {Number(retencion.porcentaje ?? 0)}%
                  {retencion.base_minima ? ` · Base mínima ${formatCOP(Number(retencion.base_minima))}` : ''}
                  {retencion.base_uvt ? ` · ${retencion.base_uvt} UVT` : ''}
                </p>
              </div>
            </label>
          )
        })}
      </div>

      {value.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Resumen de retenciones</p>
          <p className="mt-1">Retenido: {formatCOP(selected.total)}</p>
          <p>Desembolso neto: {formatCOP(Math.max(0, base - selected.total))}</p>
        </div>
      )}
    </div>
  )
}
