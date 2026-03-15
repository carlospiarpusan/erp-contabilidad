'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCOP, formatFecha, cardCls } from '@/utils/cn'
import type { FormaPagoRecaudoVenta, SistecreditoMesPendiente } from '@/lib/db/ventas'

interface Props {
  meses: SistecreditoMesPendiente[]
  formasPago: FormaPagoRecaudoVenta[]
}

function defaultObservacion(label: string) {
  return `Pago consolidado Sistecrédito ${label}`
}

export function PagoMensualSistecredito({ meses: initialMeses, formasPago }: Props) {
  const [meses, setMeses] = useState(initialMeses)
  const [mesVenta, setMesVenta] = useState(initialMeses[0]?.mes_venta ?? '')
  const [formaPagoId, setFormaPagoId] = useState(formasPago[0]?.id ?? '')
  const [fechaPago, setFechaPago] = useState(initialMeses[0]?.fecha_cobro_esperada ?? '')
  const [observaciones, setObservaciones] = useState(
    initialMeses[0] ? defaultObservacion(initialMeses[0].etiqueta_mes) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mesSeleccionado = useMemo(
    () => meses.find((item) => item.mes_venta === mesVenta) ?? null,
    [mesVenta, meses]
  )

  useEffect(() => {
    if (!mesSeleccionado) return
    setFechaPago(mesSeleccionado.fecha_cobro_esperada)
    setObservaciones(defaultObservacion(mesSeleccionado.etiqueta_mes))
  }, [mesSeleccionado])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mesSeleccionado || !formaPagoId) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/ventas/recibos/sistecredito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mes_venta: mesSeleccionado.mes_venta,
          forma_pago_id: formaPagoId,
          fecha_pago: fechaPago,
          observaciones: observaciones || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Error al registrar pago mensual')

      setSuccess(`Se pagaron ${data.facturas} factura(s) por ${formatCOP(Number(data.total ?? 0))}.`)

      setMeses((prev) => {
        const next = prev.filter((item) => item.mes_venta !== mesSeleccionado.mes_venta)
        const siguiente = next[0] ?? null
        setMesVenta(siguiente?.mes_venta ?? '')
        setFechaPago(siguiente?.fecha_cobro_esperada ?? '')
        setObservaciones(siguiente ? defaultObservacion(siguiente.etiqueta_mes) : '')
        return next
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Error al registrar pago mensual')
    } finally {
      setSaving(false)
    }
  }

  if (!meses.length) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
        No hay meses pendientes de recaudo por Sistecrédito.
      </div>
    )
  }

  if (!formasPago.length) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
        Configura al menos una forma de pago de recaudo distinta a Sistecrédito para poder aplicar el cierre mensual.
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className={`${cardCls} p-4`}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Meses pendientes</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Selecciona el mes vendido que Sistecrédito ya te pagó.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {meses.map((item) => {
            const active = item.mes_venta === mesVenta
            return (
              <button
                key={item.mes_venta}
                type="button"
                onClick={() => setMesVenta(item.mes_venta)}
                className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                  active
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{item.etiqueta_mes}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Cobro esperado {formatFecha(item.fecha_cobro_esperada)}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {item.facturas} fact.
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatCOP(item.saldo)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {mesSeleccionado && (
          <>
            <form onSubmit={handleSubmit} className={`${cardCls} p-5`}>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Mes de venta</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{mesSeleccionado.etiqueta_mes}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {mesSeleccionado.facturas} factura(s) pendientes
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Saldo pendiente</p>
                  <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">{formatCOP(mesSeleccionado.saldo)}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Cobro esperado {formatFecha(mesSeleccionado.fecha_cobro_esperada)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/70">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pagado acumulado</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{formatCOP(mesSeleccionado.pagado)}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Total facturado {formatCOP(mesSeleccionado.total)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Forma de recaudo</label>
                  <select
                    value={formaPagoId}
                    onChange={(event) => setFormaPagoId(event.target.value)}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  >
                    {formasPago.map((forma) => (
                      <option key={forma.id} value={forma.id}>{forma.descripcion}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Usa la cuenta donde realmente entra el dinero: caja, banco o transferencia.
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Fecha del pago</label>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={(event) => setFechaPago(event.target.value)}
                    required
                    className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones</label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(event) => setObservaciones(event.target.value)}
                  placeholder="Pago consolidado del convenio"
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
              </div>

              {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
              {success && <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{success}</p>}

              <div className="mt-5 flex justify-end">
                <Button type="submit" disabled={saving || !mesSeleccionado || !formaPagoId}>
                  {saving ? 'Aplicando pago...' : 'Marcar mes como pagado'}
                </Button>
              </div>
            </form>

            <div className={`${cardCls} p-5`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Facturas incluidas</h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    El proceso crea un recibo por el saldo pendiente de cada factura del mes.
                  </p>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">{mesSeleccionado.detalle.length} fila(s)</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 text-left dark:border-gray-800">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Factura</th>
                      <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Cliente</th>
                      <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Fecha</th>
                      <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Estado</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {mesSeleccionado.detalle.map((factura) => (
                      <tr key={factura.id}>
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-200">{factura.numero}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{factura.cliente}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{formatFecha(factura.fecha)}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{factura.estado}</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700 dark:text-emerald-300">
                          {formatCOP(factura.saldo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
