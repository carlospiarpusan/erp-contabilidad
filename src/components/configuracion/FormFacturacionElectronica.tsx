'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn, cardCls } from '@/utils/cn'
import { Loader2 } from 'lucide-react'

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

  const set = <K extends keyof ConfigFE>(k: K, v: ConfigFE[K]) =>
    setForm(p => ({ ...p, [k]: v }))

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
    } catch (e) {
      setMsg({ tipo: 'err', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setGuardando(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setMsg(null)
    try {
      // Guardar primero
      const saveRes = await fetch('/api/configuracion/facturacion-electronica', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!saveRes.ok) throw new Error('Error al guardar antes de probar')

      const res = await fetch('/api/configuracion/facturacion-electronica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const data = await res.json()
      setMsg({ tipo: data.ok ? 'ok' : 'err', texto: data.message })
    } catch (e) {
      setMsg({ tipo: 'err', texto: e instanceof Error ? e.message : 'Error' })
    } finally {
      setTesting(false)
    }
  }

  const inputCls = 'h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200'

  return (
    <form onSubmit={guardar} className="flex flex-col gap-6">
      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.texto}
        </div>
      )}

      {/* Estado y proveedor */}
      <div className={cn(cardCls, 'p-6')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Facturación Electrónica</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-xs font-medium ${form.activa ? 'text-green-600' : 'text-gray-400'}`}>
              {form.activa ? 'Activa' : 'Inactiva'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.activa}
              onClick={() => set('activa', !form.activa)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activa ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.activa ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Proveedor</label>
          <div className="h-9 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700 px-3 flex items-center text-sm text-gray-600 dark:text-gray-400 font-medium">
            Dataico
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Ambiente</label>
          <div className="flex gap-2">
            {(['pruebas', 'produccion'] as const).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => set('ambiente', a)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  form.ambiente === a
                    ? a === 'produccion'
                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                }`}
              >
                {a === 'pruebas' ? 'Pruebas' : 'Producción'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credenciales API */}
      <div className={cn(cardCls, 'p-6')}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Credenciales API Dataico</h3>
        <p className="text-xs text-gray-500 mb-4">
          Obtén estas credenciales desde tu cuenta en app.dataico.com &rarr; Configuración.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Auth Token</label>
            <input
              type="password"
              value={form.auth_token}
              onChange={e => set('auth_token', e.target.value)}
              placeholder="Token de autenticación de Dataico"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Account ID</label>
            <input
              type="text"
              value={form.account_id}
              onChange={e => set('account_id', e.target.value)}
              placeholder="ID de cuenta Dataico"
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing || !form.auth_token || !form.account_id}
            onClick={testConnection}
          >
            {testing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {testing ? 'Probando…' : 'Probar conexión'}
          </Button>
        </div>
      </div>

      {/* Numeración DIAN */}
      <div className={cn(cardCls, 'p-6')}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Numeración DIAN</h3>
        <p className="text-xs text-gray-500 mb-4">
          Datos de la resolución de numeración autorizada por la DIAN para facturación electrónica.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Prefijo</label>
            <input
              type="text"
              value={form.prefijo}
              onChange={e => set('prefijo', e.target.value)}
              placeholder="FE"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">No. Resolución</label>
            <input
              type="text"
              value={form.resolucion}
              onChange={e => set('resolucion', e.target.value)}
              placeholder="18760000001"
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Fecha resolución</label>
            <input
              type="date"
              value={form.fecha_resolucion ?? ''}
              onChange={e => set('fecha_resolucion', e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Rango desde</label>
              <input
                type="number"
                value={form.rango_desde ?? ''}
                onChange={e => set('rango_desde', e.target.value ? Number(e.target.value) : null)}
                placeholder="1"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Rango hasta</label>
              <input
                type="number"
                value={form.rango_hasta ?? ''}
                onChange={e => set('rango_hasta', e.target.value ? Number(e.target.value) : null)}
                placeholder="5000"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Opciones de envío */}
      <div className={cn(cardCls, 'p-6')}>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Opciones de envío</h3>
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.send_dian}
              onChange={e => set('send_dian', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-teal-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enviar a la DIAN</span>
              <p className="text-xs text-gray-500">Transmitir automáticamente cada factura a la DIAN</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.send_email}
              onChange={e => set('send_email', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-teal-600"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enviar por email</span>
              <p className="text-xs text-gray-500">Enviar copia de la factura electrónica al cliente por email</p>
            </div>
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Email para copia (opcional)</label>
            <input
              type="email"
              value={form.email_copia}
              onChange={e => set('email_copia', e.target.value)}
              placeholder="copia@empresa.com"
              className={cn(inputCls, 'max-w-md')}
            />
            <p className="text-xs text-gray-400">Recibe una copia de cada factura electrónica emitida</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </form>
  )
}
