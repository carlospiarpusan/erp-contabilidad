'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { RetencionesSelector } from '@/components/contabilidad/RetencionesSelector'
import type { RetencionActiva } from '@/lib/db/retenciones'
import type { RetencionSelection } from '@/lib/accounting/retenciones'
import { cardCls, formatCOP, formatFecha } from '@/utils/cn'
import { FileText, Plus, Search } from 'lucide-react'

interface FormaPago {
  id: string
  descripcion?: string | null
}

interface Proveedor {
  id?: string
  razon_social: string
  numero_documento?: string | null
}

interface FacturaPendiente {
  id: string
  numero: number
  prefijo: string
  fecha: string
  numero_externo?: string | null
  total: number
  pagado: number
  saldo: number
  estado: string
  proveedor?: Proveedor | null
}

interface Pago {
  id: string
  numero: number
  fecha: string
  valor: number
  observaciones?: string | null
  documento?: {
    id: string
    numero: number
    prefijo: string
    numero_externo?: string | null
    proveedor?: Proveedor | null
  } | null
  forma_pago?: { id: string; descripcion: string } | null
}

interface Props {
  pagos: Pago[]
  formasPago: FormaPago[]
  facturasPendientes: FacturaPendiente[]
  retenciones: RetencionActiva[]
  uvtValue?: number | null
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'

export function PagosProveedores({
  pagos: inicial,
  formasPago,
  facturasPendientes,
  retenciones,
  uvtValue = null,
}: Props) {
  const router = useRouter()
  const pagos = inicial
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [retencionesSeleccionadas, setRetencionesSeleccionadas] = useState<RetencionSelection[]>([])

  const [form, setForm] = useState({
    documento_id: '',
    forma_pago_id: formasPago[0]?.id ?? '',
    monto_total: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: '',
  })

  const facturaSeleccionada = useMemo(
    () => facturasPendientes.find((factura) => factura.id === form.documento_id) ?? null,
    [facturasPendientes, form.documento_id]
  )

  const sugerencias = useMemo(() => {
    const term = busqueda.trim().toLowerCase()
    if (!term || term.length < 2) return []
    return facturasPendientes
      .filter((factura) => {
        const haystack = [
          `${factura.prefijo}${factura.numero}`,
          factura.numero_externo ?? '',
          factura.proveedor?.razon_social ?? '',
          factura.proveedor?.numero_documento ?? '',
        ]
          .join(' ')
          .toLowerCase()

        return haystack.includes(term)
      })
      .slice(0, 8)
  }, [busqueda, facturasPendientes])

  function resetForm() {
    setForm({
      documento_id: '',
      forma_pago_id: formasPago[0]?.id ?? '',
      monto_total: '',
      fecha: new Date().toISOString().split('T')[0],
      observaciones: '',
    })
    setBusqueda('')
    setRetencionesSeleccionadas([])
  }

  function seleccionarFactura(factura: FacturaPendiente) {
    setForm((current) => ({
      ...current,
      documento_id: factura.id,
      monto_total: factura.saldo > 0 ? String(factura.saldo) : current.monto_total,
    }))
    setBusqueda('')
    setRetencionesSeleccionadas([])
  }

  async function crearPago() {
    if (!facturaSeleccionada) {
      setError('Selecciona una factura de compra pendiente')
      return
    }

    const monto = Number(form.monto_total)
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa un valor de pago válido')
      return
    }
    if (monto > facturaSeleccionada.saldo * 1.001) {
      setError(`El valor no puede superar el saldo pendiente (${formatCOP(facturaSeleccionada.saldo)})`)
      return
    }
    if (!form.forma_pago_id) {
      setError('Selecciona una forma de pago')
      return
    }

    setGuardando(true)
    setError('')
    try {
      const res = await fetch('/api/tesoreria/pagos-proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documento_id: facturaSeleccionada.id,
          forma_pago_id: form.forma_pago_id,
          monto_total: monto,
          fecha: form.fecha,
          observaciones: form.observaciones || null,
          retenciones: retencionesSeleccionadas,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al registrar pago')
      setModalNuevo(false)
      resetForm()
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-xs font-medium underline">Cerrar</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{pagos.length} recibo{pagos.length !== 1 ? 's' : ''} registrado{pagos.length !== 1 ? 's' : ''}</p>
          <p className="text-xs text-gray-400">
            Las salidas de dinero a proveedores deben aplicarse contra una factura de compra pendiente.
          </p>
        </div>
        <Button size="sm" onClick={() => setModalNuevo(true)} disabled={facturasPendientes.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo pago
        </Button>
      </div>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Recibo</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Factura compra</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Proveedor</th>
              <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">Forma pago</th>
              <th className="px-4 py-3 text-right text-[11px] font-medium uppercase tracking-wider text-gray-500">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {pagos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Sin recibos de compra registrados
                </td>
              </tr>
            ) : pagos.map((pago) => (
              <tr key={pago.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono font-medium text-gray-700 dark:text-gray-200">#{pago.numero}</td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{formatFecha(pago.fecha)}</td>
                <td className="px-4 py-3">
                  {pago.documento ? (
                    <>
                      <span className="font-mono text-xs text-teal-700 dark:text-teal-300">
                        {pago.documento.prefijo}{pago.documento.numero}
                      </span>
                      {pago.documento.numero_externo && (
                        <span className="block text-xs text-gray-400">Prov. {pago.documento.numero_externo}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {pago.documento?.proveedor?.razon_social ?? '—'}
                  </span>
                  {pago.documento?.proveedor?.numero_documento && (
                    <span className="block text-xs text-gray-400">{pago.documento.proveedor.numero_documento}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                  {pago.forma_pago?.descripcion ?? '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                  {formatCOP(pago.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} titulo="Aplicar pago a factura de compra" size="md">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Este flujo registra un recibo de compra y su asiento contable. Ya no se permiten egresos sueltos sin factura asociada.
          </div>

          <div>
            <label className={labelCls}>Factura de compra *</label>
            {facturaSeleccionada ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-teal-700 dark:text-teal-300">
                      {facturaSeleccionada.prefijo}{facturaSeleccionada.numero}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {facturaSeleccionada.proveedor?.razon_social ?? 'Proveedor sin nombre'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Factura proveedor: {facturaSeleccionada.numero_externo ?? '—'} · Fecha {formatFecha(facturaSeleccionada.fecha)}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Total {formatCOP(facturaSeleccionada.total)} · Pagado {formatCOP(facturaSeleccionada.pagado)} · Saldo {formatCOP(facturaSeleccionada.saldo)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, documento_id: '', monto_total: '' }))}
                    className="text-xs font-medium text-red-500 hover:text-red-700"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Buscar por número, factura proveedor o proveedor..."
                />
                {sugerencias.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {sugerencias.map((factura) => (
                      <button
                        key={factura.id}
                        type="button"
                        onClick={() => seleccionarFactura(factura)}
                        className="w-full px-3 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-teal-700 dark:text-teal-300">
                              {factura.prefijo}{factura.numero} · {factura.numero_externo ?? 'sin externo'}
                            </p>
                            <p className="truncate font-medium">{factura.proveedor?.razon_social ?? 'Proveedor sin nombre'}</p>
                          </div>
                          <Badge variant="warning">Saldo {formatCOP(factura.saldo)}</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Forma de pago *</label>
              <select
                value={form.forma_pago_id}
                onChange={(event) => setForm((current) => ({ ...current, forma_pago_id: event.target.value }))}
                className={inputCls}
              >
                <option value="">— Seleccionar —</option>
                {formasPago.map((formaPago) => (
                  <option key={formaPago.id} value={formaPago.id}>
                    {formaPago.descripcion ?? 'Sin descripción'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Fecha del pago</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Monto a pagar *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto_total}
              onChange={(event) => setForm((current) => ({ ...current, monto_total: event.target.value }))}
              className={inputCls}
              placeholder="0"
            />
            {facturaSeleccionada && (
              <p className="mt-1 text-xs text-gray-500">
                Saldo disponible para aplicar: {formatCOP(facturaSeleccionada.saldo)}
              </p>
            )}
          </div>

          <RetencionesSelector
            retenciones={retenciones}
            value={retencionesSeleccionadas}
            base={Number(form.monto_total) || 0}
            uvtValue={uvtValue}
            onChange={setRetencionesSeleccionadas}
          />

          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
              className={inputCls}
              rows={2}
              placeholder="Notas del pago..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearPago} disabled={guardando || !facturaSeleccionada || !form.monto_total || !form.forma_pago_id}>
              {guardando ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      </Modal>

      {facturasPendientes.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40">
          No hay facturas de compra pendientes de pago. Los nuevos pagos a proveedores se registran desde facturas abiertas.
        </div>
      )}
    </div>
  )
}
