'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cardCls, formatCOP, formatFecha } from '@/utils/cn'
import {
  Plus, Building2, ArrowDownCircle, ArrowUpCircle,
  ToggleLeft, ToggleRight, Eye, Banknote,
} from 'lucide-react'

interface CuentaBancaria {
  id: string; nombre: string; banco: string; tipo_cuenta: string
  numero_cuenta: string; titular?: string | null
  saldo_inicial: number; saldo_actual: number; activa: boolean
}
interface Movimiento {
  id: string; fecha: string; tipo: string; concepto: string
  monto: number; saldo_despues: number; referencia?: string | null
  descripcion?: string | null; conciliado: boolean
}

interface Props { cuentas: CuentaBancaria[] }

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'

const BANCOS = ['Bancolombia', 'Davivienda', 'BBVA', 'Banco de Bogotá', 'Banco Popular', 'Banco de Occidente', 'Scotiabank Colpatria', 'Nequi', 'Daviplata', 'Otro']
const CONCEPTOS = ['Consignación', 'Transferencia', 'Cheque', 'Nota débito', 'Nota crédito', 'Interés', 'Comisión', 'Otro']

export function CuentasBancarias({ cuentas: inicial }: Props) {
  const router = useRouter()
  const [cuentas, setCuentas] = useState(inicial)
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string | null>(null)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loadingMov, setLoadingMov] = useState(false)

  const [modalNueva, setModalNueva] = useState(false)
  const [modalMov, setModalMov] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [formCuenta, setFormCuenta] = useState({
    nombre: '', banco: 'Bancolombia', tipo_cuenta: 'ahorros',
    numero_cuenta: '', titular: '', saldo_inicial: '',
  })
  const [formMov, setFormMov] = useState({
    tipo: 'ingreso', concepto: 'Consignación', monto: '', referencia: '', descripcion: '',
  })

  const cuentaActual = cuentas.find(c => c.id === cuentaSeleccionada)

  const cargarMovimientos = useCallback(async (id: string) => {
    setLoadingMov(true)
    try {
      const res = await fetch(`/api/tesoreria/movimientos-bancarios?cuenta_id=${id}`)
      if (!res.ok) throw new Error('Error cargando movimientos')
      setMovimientos(await res.json())
    } catch { setMovimientos([]) }
    finally { setLoadingMov(false) }
  }, [])

  useEffect(() => {
    if (cuentaSeleccionada) cargarMovimientos(cuentaSeleccionada)
    else setMovimientos([])
  }, [cuentaSeleccionada, cargarMovimientos])

  async function crearCuenta() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/cuentas-bancarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formCuenta),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error')
      setCuentas(prev => [...prev, body])
      setCuentaSeleccionada(body.id)
      setModalNueva(false)
      setFormCuenta({ nombre: '', banco: 'Bancolombia', tipo_cuenta: 'ahorros', numero_cuenta: '', titular: '', saldo_inicial: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function toggleActiva(cuenta: CuentaBancaria) {
    try {
      const res = await fetch('/api/tesoreria/cuentas-bancarias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cuenta.id, activa: !cuenta.activa }),
      })
      if (!res.ok) throw new Error('Error')
      const updated = await res.json()
      setCuentas(prev => prev.map(c => c.id === cuenta.id ? { ...c, ...updated } : c))
    } catch { /* ignore */ }
  }

  async function registrarMovimiento() {
    if (!cuentaSeleccionada) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/movimientos-bancarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuenta_bancaria_id: cuentaSeleccionada,
          ...formMov,
          monto: Number(formMov.monto),
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error')
      setModalMov(false)
      setFormMov({ tipo: 'ingreso', concepto: 'Consignación', monto: '', referencia: '', descripcion: '' })
      await cargarMovimientos(cuentaSeleccionada)
      // Refresh saldo
      const cRes = await fetch('/api/tesoreria/cuentas-bancarias')
      if (cRes.ok) setCuentas(await cRes.json())
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

      {/* Lista de cuentas */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} bancaria{cuentas.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setModalNueva(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva cuenta
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cuentas.map(c => (
          <div
            key={c.id}
            className={`${cardCls} p-4 cursor-pointer transition-all hover:shadow-md ${cuentaSeleccionada === c.id ? 'ring-2 ring-teal-500 shadow-md' : ''}`}
            onClick={() => setCuentaSeleccionada(c.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-600" />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggleActiva(c) }}>
                {c.activa ? <ToggleRight className="h-5 w-5 text-green-500" /> : <ToggleLeft className="h-5 w-5 text-gray-300" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">{c.banco} &middot; {c.tipo_cuenta === 'ahorros' ? 'Ahorros' : 'Corriente'}</p>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{c.numero_cuenta}</p>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className={labelCls}>Saldo actual</p>
              <p className={`text-lg font-bold ${c.saldo_actual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCOP(c.saldo_actual)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Movimientos de la cuenta seleccionada */}
      {cuentaActual && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Movimientos — {cuentaActual.nombre}
            </h3>
            <Button size="sm" onClick={() => setModalMov(true)}>
              <Banknote className="h-4 w-4 mr-1" /> Registrar movimiento
            </Button>
          </div>

          <div className={`overflow-x-auto ${cardCls}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Tipo</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Concepto</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-medium text-gray-500">Referencia</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Monto</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-medium text-gray-500">Saldo</th>
                  <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wider font-medium text-gray-500">Conc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {loadingMov ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Cargando...</td></tr>
                ) : movimientos.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Sin movimientos</td></tr>
                ) : movimientos.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{formatFecha(m.fecha)}</td>
                    <td className="px-4 py-3">
                      {m.tipo === 'ingreso'
                        ? <Badge variant="success">Ingreso</Badge>
                        : <Badge variant="danger">Egreso</Badge>}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{m.concepto}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{m.referencia ?? '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatCOP(m.monto)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{formatCOP(m.saldo_despues ?? 0)}</td>
                    <td className="px-4 py-3 text-center">
                      {m.conciliado
                        ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" title="Conciliado" />
                        : <span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700" title="Pendiente" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nueva cuenta */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)} titulo="Nueva cuenta bancaria" size="md">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input value={formCuenta.nombre} onChange={e => setFormCuenta(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Bancolombia Ahorros" />
            </div>
            <div>
              <label className={labelCls}>Banco *</label>
              <select value={formCuenta.banco} onChange={e => setFormCuenta(f => ({ ...f, banco: e.target.value }))} className={inputCls}>
                {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de cuenta *</label>
              <select value={formCuenta.tipo_cuenta} onChange={e => setFormCuenta(f => ({ ...f, tipo_cuenta: e.target.value }))} className={inputCls}>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Número de cuenta *</label>
              <input value={formCuenta.numero_cuenta} onChange={e => setFormCuenta(f => ({ ...f, numero_cuenta: e.target.value }))} className={inputCls} placeholder="0000-0000-0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Titular</label>
              <input value={formCuenta.titular} onChange={e => setFormCuenta(f => ({ ...f, titular: e.target.value }))} className={inputCls} placeholder="Nombre del titular" />
            </div>
            <div>
              <label className={labelCls}>Saldo inicial</label>
              <input type="number" min="0" step="1000" value={formCuenta.saldo_inicial} onChange={e => setFormCuenta(f => ({ ...f, saldo_inicial: e.target.value }))} className={inputCls} placeholder="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalNueva(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearCuenta} disabled={guardando || !formCuenta.nombre || !formCuenta.numero_cuenta}>
              {guardando ? 'Guardando...' : 'Crear cuenta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal movimiento */}
      <Modal open={modalMov} onClose={() => setModalMov(false)} titulo="Registrar movimiento bancario" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Tipo *</label>
            <select value={formMov.tipo} onChange={e => setFormMov(f => ({ ...f, tipo: e.target.value }))} className={inputCls}>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Concepto *</label>
            <select value={formMov.concepto} onChange={e => setFormMov(f => ({ ...f, concepto: e.target.value }))} className={inputCls}>
              {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto *</label>
            <input type="number" min="1" step="1000" value={formMov.monto} onChange={e => setFormMov(f => ({ ...f, monto: e.target.value }))} className={inputCls} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Referencia</label>
            <input value={formMov.referencia} onChange={e => setFormMov(f => ({ ...f, referencia: e.target.value }))} className={inputCls} placeholder="No. cheque, ref. transferencia..." />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={formMov.descripcion} onChange={e => setFormMov(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Detalle opcional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setModalMov(false)}>Cancelar</Button>
            <Button size="sm" onClick={registrarMovimiento} disabled={guardando || !formMov.monto || Number(formMov.monto) <= 0}>
              {guardando ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
