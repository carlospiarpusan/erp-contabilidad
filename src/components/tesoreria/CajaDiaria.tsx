'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { cardCls, formatCOP } from '@/utils/cn'
import {
  Plus, Vault, DoorOpen, DoorClosed,
  Clock, Banknote, AlertTriangle, CheckCircle2,
} from 'lucide-react'

/* ─── Types ─── */
interface Caja { id: string; nombre: string; descripcion?: string | null }
interface Turno {
  id: string; caja_id: string; usuario_id: string
  saldo_apertura: number; saldo_cierre: number | null
  saldo_sistema: number | null; diferencia: number | null
  fecha_apertura: string; fecha_cierre: string | null
  observaciones?: string | null; estado: string
  caja?: { id: string; nombre: string } | null
}
interface Movimiento {
  id: string; turno_id: string; tipo: string
  concepto: string; monto: number; descripcion?: string | null
  created_at: string
}

interface Props { cajas: Caja[] }

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
const labelCls = 'block text-[11px] uppercase tracking-wider font-medium text-gray-500 mb-1'
const CONCEPTOS = ['Venta', 'Abono cliente', 'Compra', 'Gasto', 'Pago proveedor', 'Retiro', 'Consignación', 'Otro']

export function CajaDiaria({ cajas: cajasInicial }: Props) {
  const router = useRouter()

  /* ─── State ─── */
  const [cajas, setCajas] = useState<Caja[]>(cajasInicial)
  const [cajaId, setCajaId] = useState<string>(cajasInicial[0]?.id ?? '')
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [error, setError] = useState('')

  // Modals
  const [modalCaja, setModalCaja] = useState(false)
  const [modalAbrir, setModalAbrir] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)
  const [modalMov, setModalMov] = useState(false)

  // Forms
  const [formCaja, setFormCaja] = useState({ nombre: '', descripcion: '' })
  const [formApertura, setFormApertura] = useState('')
  const [formCierre, setFormCierre] = useState({ saldo_cierre: '', observaciones: '' })
  const [formMov, setFormMov] = useState({ tipo: 'ingreso', concepto: 'Venta', monto: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)

  /* ─── Derived ─── */
  const turnoActual = turnos.find(t => t.caja_id === cajaId && t.estado === 'abierto')
  const turnoActualId = turnoActual?.id ?? ''
  const turnosHistoricos = turnos
    .filter(t => t.caja_id === cajaId && t.estado !== 'abierto')
    .slice(0, 10)

  const totalIngresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)
  const totalEgresos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + m.monto, 0)
  const saldoActual = totalIngresos - totalEgresos

  const diferenciaCierre = formCierre.saldo_cierre
    ? Number(formCierre.saldo_cierre) - saldoActual
    : 0

  /* ─── Data fetching ─── */
  const cargarTurnos = useCallback(async () => {
    try {
      const res = await fetch('/api/tesoreria/turnos')
      if (!res.ok) throw new Error('Error cargando turnos')
      const data: Turno[] = await res.json()
      setTurnos(data)
    } catch { /* ignore */ }
  }, [])

  const cargarMovimientos = useCallback(async (turnoId: string) => {
    try {
      const res = await fetch(`/api/tesoreria/movimientos?turno_id=${turnoId}`)
      if (!res.ok) throw new Error('Error cargando movimientos')
      const data: Movimiento[] = await res.json()
      setMovimientos(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { cargarTurnos() }, [cargarTurnos])

  useEffect(() => {
    if (turnoActualId) cargarMovimientos(turnoActualId)
    else setMovimientos([])
  }, [turnoActualId, cargarMovimientos])

  /* ─── Handlers ─── */
  async function crearCaja() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/cajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formCaja),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al crear caja')
      setCajas(prev => [...prev, body as Caja])
      setCajaId(body.id)
      setModalCaja(false)
      setFormCaja({ nombre: '', descripcion: '' })
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function abrirTurno() {
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caja_id: cajaId, saldo_apertura: Number(formApertura) || 0 }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al abrir turno')
      setModalAbrir(false)
      setFormApertura('')
      await cargarTurnos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function cerrarTurno() {
    if (!turnoActual) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/turnos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turnoActual.id,
          saldo_cierre: Number(formCierre.saldo_cierre) || 0,
          observaciones: formCierre.observaciones || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al cerrar turno')
      setModalCerrar(false)
      setFormCierre({ saldo_cierre: '', observaciones: '' })
      setMovimientos([])
      await cargarTurnos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  async function registrarMovimiento() {
    if (!turnoActual) return
    setGuardando(true); setError('')
    try {
      const res = await fetch('/api/tesoreria/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id: turnoActual.id,
          tipo: formMov.tipo,
          concepto: formMov.concepto,
          monto: Number(formMov.monto),
          descripcion: formMov.descripcion || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Error al registrar movimiento')
      setModalMov(false)
      setFormMov({ tipo: 'ingreso', concepto: 'Venta', monto: '', descripcion: '' })
      await cargarMovimientos(turnoActual.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setGuardando(false) }
  }

  function fmtFecha(iso: string) {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  }

  /* ─── Render ─── */
  return (
    <div className="flex flex-col gap-6">
      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700 text-xs font-medium">Cerrar</button>
        </div>
      )}

      {/* ── Selector de caja ── */}
      <div className={`${cardCls} p-5`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex-1 w-full">
            <label className={labelCls}>Caja</label>
            <select
              value={cajaId}
              onChange={e => setCajaId(e.target.value)}
              className={inputCls}
            >
              {cajas.length === 0 && <option value="">— Sin cajas —</option>}
              {cajas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <Button size="sm" variant="outline" onClick={() => setModalCaja(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nueva caja
          </Button>
        </div>
      </div>

      {/* ── Turno actual ── */}
      {turnoActual ? (
        <div className={`${cardCls} p-5 flex flex-col gap-5`}>
          <div className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Turno abierto</h2>
            <Badge variant="success">Abierto</Badge>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50 p-4">
              <p className={labelCls}>Apertura</p>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCOP(turnoActual.saldo_apertura)}</p>
              <p className="text-[10px] text-gray-400 mt-1">{fmtFecha(turnoActual.fecha_apertura)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20 p-4">
              <p className={labelCls}>Ingresos</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCOP(totalIngresos)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20 p-4">
              <p className={labelCls}>Egresos</p>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">{formatCOP(totalEgresos)}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-teal-50 dark:border-teal-900/30 dark:bg-teal-900/20 p-4">
              <p className={labelCls}>Saldo actual</p>
              <p className="text-sm font-bold text-teal-700 dark:text-teal-400">{formatCOP(saldoActual)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModalMov(true)}>
              <Banknote className="h-4 w-4 mr-1" /> Registrar Movimiento
            </Button>
            <Button size="sm" variant="destructive" onClick={() => {
              setFormCierre({ saldo_cierre: String(saldoActual), observaciones: '' })
              setModalCerrar(true)
            }}>
              <DoorClosed className="h-4 w-4 mr-1" /> Cerrar Caja
            </Button>
          </div>

          {/* Movements table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Movimientos del turno</h3>
            <div className={`overflow-x-auto ${cardCls}`}>
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Concepto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Descripción</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {movimientos.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Sin movimientos</td></tr>
                  ) : movimientos.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(m.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        {m.tipo === 'ingreso'
                          ? <Badge variant="success">Ingreso</Badge>
                          : <Badge variant="danger">Egreso</Badge>
                        }
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{m.concepto}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.descripcion ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.tipo === 'ingreso' ? '+' : '-'}{formatCOP(m.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ── No turno open ── */
        cajaId && (
          <div className={`${cardCls} p-8 text-center flex flex-col items-center gap-4`}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-900/20">
              <Vault className="h-7 w-7 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Caja cerrada</h2>
              <p className="text-sm text-gray-500 mt-1">No hay un turno abierto para esta caja</p>
            </div>
            <Button onClick={() => setModalAbrir(true)}>
              <DoorOpen className="h-4 w-4 mr-1" /> Abrir Caja
            </Button>
          </div>
        )
      )}

      {/* ── Historical turnos ── */}
      {turnosHistoricos.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Turnos anteriores
          </h3>
          <div className={`overflow-x-auto ${cardCls}`}>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Apertura</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Cierre</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Diferencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {turnosHistoricos.map(t => {
                  const dif = t.diferencia ?? 0
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{fmtFecha(t.fecha_apertura)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{formatCOP(t.saldo_apertura)}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">{formatCOP(t.saldo_cierre ?? 0)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 font-semibold ${dif === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {dif === 0
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <AlertTriangle className="h-3.5 w-3.5" />
                          }
                          {formatCOP(dif)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Modals ═══ */}

      {/* Nueva caja */}
      <Modal open={modalCaja} onClose={() => setModalCaja(false)} titulo="Nueva caja" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={formCaja.nombre} onChange={e => setFormCaja(f => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Caja principal" />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input value={formCaja.descripcion} onChange={e => setFormCaja(f => ({ ...f, descripcion: e.target.value }))} className={inputCls} placeholder="Punto de venta 1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalCaja(false)}>Cancelar</Button>
            <Button size="sm" onClick={crearCaja} disabled={guardando || !formCaja.nombre}>
              {guardando ? 'Guardando...' : 'Crear caja'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Abrir turno */}
      <Modal open={modalAbrir} onClose={() => setModalAbrir(false)} titulo="Abrir caja" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Saldo de apertura</label>
            <input
              type="number" min="0" step="100"
              value={formApertura}
              onChange={e => setFormApertura(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalAbrir(false)}>Cancelar</Button>
            <Button size="sm" onClick={abrirTurno} disabled={guardando}>
              {guardando ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cerrar turno */}
      <Modal open={modalCerrar} onClose={() => setModalCerrar(false)} titulo="Cerrar caja" size="sm">
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm">
            <p className="text-gray-500">Saldo esperado del sistema:</p>
            <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{formatCOP(saldoActual)}</p>
          </div>
          <div>
            <label className={labelCls}>Saldo de cierre (conteo fisico)</label>
            <input
              type="number" min="0" step="100"
              value={formCierre.saldo_cierre}
              onChange={e => setFormCierre(f => ({ ...f, saldo_cierre: e.target.value }))}
              className={inputCls}
              placeholder="0"
            />
          </div>
          {formCierre.saldo_cierre && (
            <div className={`rounded-lg p-3 text-sm ${diferenciaCierre === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <p className="text-gray-500">Diferencia:</p>
              <p className={`font-bold text-lg ${diferenciaCierre === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                {formatCOP(diferenciaCierre)}
              </p>
            </div>
          )}
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea
              value={formCierre.observaciones}
              onChange={e => setFormCierre(f => ({ ...f, observaciones: e.target.value }))}
              className={inputCls}
              rows={2}
              placeholder="Notas sobre el cierre..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setModalCerrar(false)}>Cancelar</Button>
            <Button size="sm" variant="destructive" onClick={cerrarTurno} disabled={guardando || !formCierre.saldo_cierre}>
              {guardando ? 'Cerrando...' : 'Cerrar caja'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Registrar movimiento */}
      <Modal open={modalMov} onClose={() => setModalMov(false)} titulo="Registrar movimiento" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Tipo *</label>
            <select
              value={formMov.tipo}
              onChange={e => setFormMov(f => ({ ...f, tipo: e.target.value }))}
              className={inputCls}
            >
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Concepto *</label>
            <select
              value={formMov.concepto}
              onChange={e => setFormMov(f => ({ ...f, concepto: e.target.value }))}
              className={inputCls}
            >
              {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Monto *</label>
            <input
              type="number" min="1" step="100"
              value={formMov.monto}
              onChange={e => setFormMov(f => ({ ...f, monto: e.target.value }))}
              className={inputCls}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <input
              value={formMov.descripcion}
              onChange={e => setFormMov(f => ({ ...f, descripcion: e.target.value }))}
              className={inputCls}
              placeholder="Detalle opcional"
            />
          </div>
          <div className="flex justify-end gap-2">
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
