'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cardCls, formatCOP, formatFecha } from '@/utils/cn'
import { Plus, Search } from 'lucide-react'

interface CuentaBancaria { id: string; nombre: string; banco: string }
interface FormaPago { id: string; nombre: string }
interface Proveedor { id: string; razon_social: string; numero_documento: string }
interface Pago {
  id: string; numero: number; fecha: string; monto_total: number
  referencia?: string | null; observaciones?: string | null; estado: string
  proveedor?: Proveedor | null
  cuenta?: { id: string; nombre: string; banco: string } | null
  forma_pago?: { id: string; nombre: string } | null
}

interface Props {
  pagos: Pago[]
  cuentas: CuentaBancaria[]
  formasPago: FormaPago[]
}

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'

const BADGE_ESTADO: Record<string, 'success' | 'warning' | 'danger'> = {
  pagado: 'success',
  pendiente: 'warning',
  anulado: 'danger',
}

export function PagosProveedores({ pagos: inicial, cuentas, formasPago }: Props) {
  const router = useRouter()
  const [pagos, setPagos] = useState(inicial)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loadingProv, setLoadingProv] = useState(false)

  const [form, setForm] = useState({
    proveedor_id: '', proveedor_nombre: '',
    cuenta_bancaria_id: '', forma_pago_id: '',
    monto_total: '', referencia: '', observaciones: '',
  })

  // Search proveedores
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      const q = busqueda.trim()
      if (!q || q.length < 2) { setProveedores([]); return }
      setLoadingProv(true)
      try {
        const res = await fetch(`/api/compras/proveedores?q=${encodeURIComponent(q)}&limit=8`, { signal: ctrl.signal })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setProveedores(Array.isArray(data?.proveedores) ? data.proveedores : (Array.isArray(data) ? data : []))
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setProveedores([])
      } finally { setLoadingProv(false) }
    }, 250)
    return () => { ctrl.abort(); clearTimeout(t) }
  }, [busqueda])

  function seleccionarProveedor(p: Proveedor) {
    setForm(f => ({ ...f, proveedor_id: p.id, proveedor_nombre: p.razon_social }))
    setBusqueda('')
    setProveedores([])
  }

  async function crearPago() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/pagos-proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedor_id: form.proveedor_id,
          cuenta_bancaria_id: form.cuenta_bancaria_id || null,
          forma_pago_id: form.forma_pago_id || null,
          monto_total: Number(form.monto_total),
          referencia: form.referencia || null,
          observaciones: form.observaciones || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error')
      setPagos(prev => [body, ...prev])
      setModalNuevo(false)
      setForm({ proveedor_id: '', proveedor_nombre: '', cuenta_bancaria_id: '', forma_pago_id: '', monto_total: '', referencia: '', observaciones: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-xs font-medium underline">Cerrar</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{pagos.length} pago{pagos.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setModalNuevo(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo pago
        </Button>
      </div>

      <div className={`overflow-x-auto ${cardCls}`}>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">N.o</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Fecha</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Proveedor</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Medio</th>
              <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Referencia</th>
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Monto</th>
              <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-medium text-gray-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {pagos.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin pagos registrados</td></tr>
            ) : pagos.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono font-medium text-gray-700 dark:text-gray-200">#{p.numero}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{formatFecha(p.fecha)}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{p.proveedor?.razon_social ?? '—'}</span>
                  {p.proveedor?.numero_documento && <span className="block text-xs text-gray-400">{p.proveedor.numero_documento}</span>}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                  {p.forma_pago?.nombre ?? p.cuenta?.banco ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono">{p.referencia ?? '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCOP(p.monto_total)}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={BADGE_ESTADO[p.estado] ?? 'warning'}>{p.estado}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo pago */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} titulo="Nuevo pago a proveedor" size="md">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Proveedor *</label>
            {form.proveedor_id ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900 dark:text-gray-100 font-medium">{form.proveedor_nombre}</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, proveedor_id: '', proveedor_nombre: '' }))}
                  className="text-xs text-red-500 hover:text-red-700"
                >Cambiar</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Buscar proveedor..."
                />
                {(loadingProv || proveedores.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {loadingProv ? (
                      <div className="px-3 py-2 text-sm text-gray-500">Buscando...</div>
                    ) : proveedores.map(p => (
                      <button key={p.id} type="button" onClick={() => seleccionarProveedor(p)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">
                        <span className="font-medium">{p.razon_social}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.numero_documento}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Forma de pago</label>
              <select value={form.forma_pago_id} onChange={e => setForm(f => ({ ...f, forma_pago_id: e.target.value }))} className={inputCls}>
                <option value="">— Seleccionar —</option>
                {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cuenta bancaria</label>
              <select value={form.cuenta_bancaria_id} onChange={e => setForm(f => ({ ...f, cuenta_bancaria_id: e.target.value }))} className={inputCls}>
                <option value="">— Seleccionar —</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Monto total *</label>
              <input type="number" min="1" step="1000" value={form.monto_total} onChange={e => setForm(f => ({ ...f, monto_total: e.target.value }))} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Referencia</label>
              <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} className={inputCls} placeholder="No. transferencia..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} className={inputCls} rows={2} placeholder="Notas..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalNuevo(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearPago} disabled={guardando || !form.proveedor_id || !form.monto_total}>
              {guardando ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
