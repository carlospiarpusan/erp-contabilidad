'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, cardCls } from '@/utils/cn'
import { Loader2, Shield, Key, Hash, Send, CheckCircle2, XCircle, AlertTriangle, ExternalLink, Eye, EyeOff, Zap } from 'lucide-react'

interface ConfigFE {
  activa: boolean
  ambiente: string
  auth_token: string
  account_id: string
  prefijo: string
  resolucion: string
  fecha_resolucion: string
  rango_desde: number | null
  rango_hasta: number | null
  send_dian: boolean
  send_email: boolean
  email_copia: string
}

const DEFAULTS: ConfigFE = {
  activa: false,
  ambiente: 'pruebas',
  auth_token: '',
  account_id: '',
  prefijo: '',
  resolucion: '',
  fecha_resolucion: '',
  rango_desde: null,
  rango_hasta: null,
  send_dian: true,
  send_email: true,
  email_copia: '',
}

interface Props { config: ConfigFE | null }

export function FormFacturacionElectronica({ config }: Props) {
  const [form, setForm] = useState<ConfigFE>({ ...DEFAULTS, ...config })
  const [guardando, setGuardando] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showToken, setShowToken] = useState(false)

  const set = <K extends keyof ConfigFE>(k: K, v: ConfigFE[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  const hasCredentials = !!form.auth_token && !!form.account_id
  const hasNumbering = !!form.prefijo && !!form.resolucion

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/configuracion/facturacion-electronica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al guardar')
      setMsg({ tipo: 'ok', texto: 'Configuración guardada correctamente.' })
      setTimeout(() => setMsg(null), 4000)
    } catch (e) {
      setMsg({ tipo: 'err', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setGuardando(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/configuracion/facturacion-electronica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', auth_token: form.auth_token, account_id: form.account_id, ambiente: form.ambiente }),
      })
      const data = await res.json()
      setTestResult({ ok: data.ok, message: data.message })
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Error de conexión' })
    } finally {
      setTesting(false)
    }
  }

  const inputCls = 'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-shadow dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200'
  const labelCls = 'text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400'
  const helpCls = 'text-[11px] text-gray-400 mt-1'

  // -- Step indicators --
  const steps = [
    { label: 'Credenciales', done: hasCredentials },
    { label: 'Numeración', done: hasNumbering },
    { label: 'Opciones', done: true },
  ]

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">

      {/* ── Status Banner ── */}
      <div className={cn(cardCls, 'p-0 overflow-hidden')}>
        <div className={`px-6 py-4 flex items-center justify-between ${
          form.activa
            ? 'bg-gradient-to-r from-teal-600 to-teal-500'
            : 'bg-gradient-to-r from-gray-600 to-gray-500'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${form.activa ? 'bg-white/20' : 'bg-white/10'}`}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Dataico</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  form.ambiente === 'produccion'
                    ? 'bg-green-400/20 text-green-100 ring-1 ring-green-400/30'
                    : 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/30'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${form.ambiente === 'produccion' ? 'bg-green-300' : 'bg-amber-300'}`} />
                  {form.ambiente === 'produccion' ? 'Producción' : 'Pruebas'}
                </span>
              </div>
              <p className="text-sm text-white/70">Facturación electrónica ante la DIAN</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => set('activa', !form.activa)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${form.activa ? 'bg-white/30' : 'bg-white/10'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.activa ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Progress steps */}
        <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1 flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    s.done
                      ? 'bg-teal-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                  }`}>
                    {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-xs font-medium ${s.done ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-px flex-1 mr-2 ${s.done ? 'bg-teal-300 dark:bg-teal-700' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toast message */}
      {msg && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
          msg.tipo === 'ok'
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
        }`}>
          {msg.tipo === 'ok' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {msg.texto}
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LEFT: Credenciales + Ambiente */}
        <div className="flex flex-col gap-5">

          {/* Ambiente */}
          <div className={cn(cardCls, 'p-0 overflow-hidden')}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <Shield className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ambiente</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-3">
                {(['pruebas', 'produccion'] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set('ambiente', a)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      form.ambiente === a
                        ? a === 'produccion'
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm'
                          : 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      form.ambiente === a
                        ? a === 'produccion'
                          ? 'bg-green-500 text-white'
                          : 'bg-amber-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {a === 'pruebas'
                        ? <AlertTriangle className="h-4 w-4" />
                        : <CheckCircle2 className="h-4 w-4" />
                      }
                    </div>
                    <div className="text-center">
                      <span className={`text-sm font-semibold block ${
                        form.ambiente === a
                          ? a === 'produccion' ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'
                          : 'text-gray-500'
                      }`}>
                        {a === 'pruebas' ? 'Pruebas' : 'Producción'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {a === 'pruebas' ? 'Sin validez fiscal' : 'Envío real a la DIAN'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Credenciales */}
          <div className={cn(cardCls, 'p-0 overflow-hidden')}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Credenciales API</h3>
              </div>
              {hasCredentials && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="h-3 w-3" /> Configurado
                </span>
              )}
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                Obtenlas desde
                <a href="https://app.dataico.com" target="_blank" rel="noopener noreferrer"
                   className="text-teal-600 dark:text-teal-400 font-medium inline-flex items-center gap-0.5 hover:underline">
                  app.dataico.com <ExternalLink className="h-3 w-3" />
                </a>
              </p>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Auth Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={form.auth_token}
                    onChange={e => set('auth_token', e.target.value)}
                    placeholder="Ingresa tu token de autenticación"
                    className={cn(inputCls, 'pr-10 font-mono')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Account ID</label>
                <input
                  type="text"
                  value={form.account_id}
                  onChange={e => set('account_id', e.target.value)}
                  placeholder="ID de tu cuenta Dataico"
                  className={cn(inputCls, 'font-mono')}
                />
              </div>

              {/* Test connection */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={testing || !hasCredentials}
                    onClick={testConnection}
                    className="gap-2"
                  >
                    {testing
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Zap className="h-3.5 w-3.5" />
                    }
                    {testing ? 'Verificando...' : 'Probar conexión'}
                  </Button>
                  {!hasCredentials && (
                    <span className="text-[11px] text-gray-400">Completa los campos primero</span>
                  )}
                </div>
                {testResult && (
                  <div className={`mt-3 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${
                    testResult.ok
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    {testResult.ok
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    }
                    <div>
                      <p className={`font-medium ${testResult.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {testResult.ok ? 'Conexión exitosa' : 'Error de conexión'}
                      </p>
                      <p className={`text-xs mt-0.5 ${testResult.ok ? 'text-green-600/70 dark:text-green-400/70' : 'text-red-600/70 dark:text-red-400/70'}`}>
                        {testResult.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Numeración + Envío */}
        <div className="flex flex-col gap-5">

          {/* Numeración DIAN */}
          <div className={cn(cardCls, 'p-0 overflow-hidden')}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Numeración DIAN</h3>
              </div>
              {hasNumbering && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="h-3 w-3" /> Configurado
                </span>
              )}
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Resolución de numeración autorizada por la DIAN para facturación electrónica.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Prefijo</label>
                  <input
                    type="text"
                    value={form.prefijo}
                    onChange={e => set('prefijo', e.target.value)}
                    placeholder="FE"
                    className={cn(inputCls, 'font-mono')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>No. Resolución</label>
                  <input
                    type="text"
                    value={form.resolucion}
                    onChange={e => set('resolucion', e.target.value)}
                    placeholder="18760000001"
                    className={cn(inputCls, 'font-mono')}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Fecha de resolución</label>
                <input
                  type="date"
                  value={form.fecha_resolucion ?? ''}
                  onChange={e => set('fecha_resolucion', e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={cn(labelCls, 'mb-1.5 block')}>Rango autorizado</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400">Desde</span>
                    <input
                      type="number"
                      value={form.rango_desde ?? ''}
                      onChange={e => set('rango_desde', e.target.value ? Number(e.target.value) : null)}
                      placeholder="1"
                      className={cn(inputCls, 'pl-14 font-mono')}
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-gray-400">Hasta</span>
                    <input
                      type="number"
                      value={form.rango_hasta ?? ''}
                      onChange={e => set('rango_hasta', e.target.value ? Number(e.target.value) : null)}
                      placeholder="5000"
                      className={cn(inputCls, 'pl-14 font-mono')}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Opciones de envío */}
          <div className={cn(cardCls, 'p-0 overflow-hidden')}>
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <Send className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Opciones de envío</h3>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.send_dian}
                  onChange={e => set('send_dian', e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Enviar a la DIAN</span>
                  <span className={helpCls}>Transmitir automáticamente cada factura a la DIAN al momento de emitirla</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  form.send_dian
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
                }`}>{form.send_dian ? 'Activo' : 'Inactivo'}</div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.send_email}
                  onChange={e => set('send_email', e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block">Enviar por email al cliente</span>
                  <span className={helpCls}>El cliente recibirá la factura electrónica en su correo registrado</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  form.send_email
                    ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
                }`}>{form.send_email ? 'Activo' : 'Inactivo'}</div>
              </label>

              <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                <label className={labelCls}>Email para copia (BCC)</label>
                <input
                  type="email"
                  value={form.email_copia}
                  onChange={e => set('email_copia', e.target.value)}
                  placeholder="contabilidad@empresa.com"
                  className={inputCls}
                />
                <p className={helpCls}>Opcional. Recibe una copia de cada factura electrónica emitida.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className={cn(cardCls, 'px-5 py-4')}>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Los cambios se aplican a todas las facturas nuevas emitidas desde el POS y ventas.
          </p>
          <Button type="submit" disabled={guardando} className="gap-2 min-w-[180px]">
            {guardando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
              : 'Guardar configuración'
            }
          </Button>
        </div>
      </div>
    </form>
  )
}
