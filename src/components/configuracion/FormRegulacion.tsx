'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, DatabaseZap, FileWarning, PlayCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardCls, cn } from '@/utils/cn'
import type { ComplianceJob, RegulatoryConfig, UvtVigencia } from '@/lib/db/compliance'

interface Props {
  config: RegulatoryConfig
  uvts: UvtVigencia[]
  jobs: ComplianceJob[]
}

export function FormRegulacion({ config, uvts, jobs }: Props) {
  const router = useRouter()
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState({
    obligado_fe: Boolean(config.obligado_fe),
    usa_proveedor_fe: Boolean(config.usa_proveedor_fe),
    requiere_documento_soporte: config.requiere_documento_soporte ?? true,
    reporta_exogena: config.reporta_exogena ?? true,
    usa_radian: Boolean(config.usa_radian),
    politica_datos_version: config.politica_datos_version ?? '',
    politica_datos_url: config.politica_datos_url ?? '',
    aviso_privacidad_url: config.aviso_privacidad_url ?? '',
    contacto_privacidad_email: config.contacto_privacidad_email ?? '',
  })
  const [uvtForm, setUvtForm] = useState({
    año: String(uvts[0]?.año ?? currentYear),
    valor: uvts[0]?.valor ? String(uvts[0].valor) : '',
    fuente: uvts[0]?.fuente ?? 'DIAN',
  })
  const [saving, setSaving] = useState(false)
  const [savingUvt, setSavingUvt] = useState(false)
  const [jobRunning, setJobRunning] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const latestJobs = useMemo(() => jobs.slice(0, 8), [jobs])

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function showMessage(type: 'ok' | 'error', text: string) {
    setMessage({ type, text })
    window.setTimeout(() => setMessage(null), 4000)
  }

  async function saveConfig() {
    setSaving(true)
    try {
      const res = await fetch('/api/configuracion/regulacion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar la configuración')
      showMessage('ok', 'Configuración regulatoria actualizada.')
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  async function saveUvt() {
    setSavingUvt(true)
    try {
      const res = await fetch('/api/configuracion/regulacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'uvt',
          año: Number(uvtForm.año),
          valor: Number(uvtForm.valor),
          fuente: uvtForm.fuente || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar la UVT')
      showMessage('ok', `UVT ${uvtForm.año} guardada.`)
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'No se pudo guardar la UVT')
    } finally {
      setSavingUvt(false)
    }
  }

  async function enqueue(tipo: string, payload?: Record<string, unknown>) {
    setJobRunning(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, payload }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo crear el job')
      showMessage('ok', 'Job creado en cola.')
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'No se pudo crear el job')
    } finally {
      setJobRunning(false)
    }
  }

  async function runQueue() {
    setJobRunning(true)
    try {
      const res = await fetch('/api/jobs/run', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo ejecutar la cola')
      showMessage('ok', `Cola ejecutada. ${Array.isArray(data?.results) ? data.results.length : 0} job(s) procesados.`)
      router.refresh()
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'No se pudo ejecutar la cola')
    } finally {
      setJobRunning(false)
    }
  }

  const inputCls =
    'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <div className="flex flex-col gap-6">
      <div className={cn(cardCls, 'border-amber-200 bg-amber-50 p-5')}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-amber-950">Alcance regulatorio de ClovEnt</h2>
            <p className="mt-1 text-sm text-amber-900/80">
              ClovEnt no ofrece facturación electrónica nativa. Aquí se define el perfil regulatorio de la empresa
              para soportes, exógena, privacidad e integración externa.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          message.type === 'ok'
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border border-red-200 bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={cn(cardCls, 'p-5')}>
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600" />
            <h2 className="text-base font-semibold text-gray-900">Configuración regulatoria</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.obligado_fe}
                  onChange={(e) => updateField('obligado_fe', e.target.checked)}
                />
                Empresa obligada a facturar electrónicamente
              </div>
              <p className="mt-2 text-xs text-gray-400">Solo informativo para cumplimiento e integraciones externas.</p>
            </label>

            <label className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.usa_proveedor_fe}
                  onChange={(e) => updateField('usa_proveedor_fe', e.target.checked)}
                />
                Usa proveedor tecnológico externo
              </div>
              <p className="mt-2 text-xs text-gray-400">Controla mensajes, validaciones y reportes de integración.</p>
            </label>

            <label className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requiere_documento_soporte}
                  onChange={(e) => updateField('requiere_documento_soporte', e.target.checked)}
                />
                Exigir documento soporte cuando aplique
              </div>
              <p className="mt-2 text-xs text-gray-400">Se combina con el perfil de cada proveedor.</p>
            </label>

            <label className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.reporta_exogena}
                  onChange={(e) => updateField('reporta_exogena', e.target.checked)}
                />
                Reporta información exógena
              </div>
              <p className="mt-2 text-xs text-gray-400">Habilita validaciones y exportes por vigencia.</p>
            </label>

            <label className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 md:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.usa_radian}
                  onChange={(e) => updateField('usa_radian', e.target.checked)}
                />
                Usa RADIAN por integración externa
              </div>
              <p className="mt-2 text-xs text-gray-400">
                No activa envío desde ClovEnt; solo deja trazabilidad del perfil regulatorio de la empresa.
              </p>
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Versión política de datos
              </label>
              <input
                className={inputCls}
                value={form.politica_datos_version}
                onChange={(e) => updateField('politica_datos_version', e.target.value)}
                placeholder="v1.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Email contacto privacidad
              </label>
              <input
                className={inputCls}
                type="email"
                value={form.contacto_privacidad_email}
                onChange={(e) => updateField('contacto_privacidad_email', e.target.value)}
                placeholder="privacidad@clovent.co"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                URL política de datos
              </label>
              <input
                className={inputCls}
                value={form.politica_datos_url}
                onChange={(e) => updateField('politica_datos_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                URL aviso de privacidad
              </label>
              <input
                className={inputCls}
                value={form.aviso_privacidad_url}
                onChange={(e) => updateField('aviso_privacidad_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuración'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className={cn(cardCls, 'p-5')}>
            <div className="mb-4 flex items-center gap-2">
              <DatabaseZap className="h-4 w-4 text-teal-600" />
              <h2 className="text-base font-semibold text-gray-900">UVT por vigencia</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className={inputCls}
                type="number"
                value={uvtForm.año}
                onChange={(e) => setUvtForm((prev) => ({ ...prev, año: e.target.value }))}
                placeholder="Año"
              />
              <input
                className={inputCls}
                type="number"
                value={uvtForm.valor}
                onChange={(e) => setUvtForm((prev) => ({ ...prev, valor: e.target.value }))}
                placeholder="Valor UVT"
              />
              <input
                className={inputCls}
                value={uvtForm.fuente}
                onChange={(e) => setUvtForm((prev) => ({ ...prev, fuente: e.target.value }))}
                placeholder="Fuente"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="outline" onClick={saveUvt} disabled={savingUvt}>
                {savingUvt ? 'Guardando...' : 'Guardar UVT'}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {uvts.length === 0 ? (
                <p className="text-sm text-gray-400">Todavía no hay vigencias UVT configuradas.</p>
              ) : uvts.map((uvt) => (
                <div key={uvt.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{uvt.año}</span>
                  <span className="font-mono text-gray-600">${new Intl.NumberFormat('es-CO').format(Number(uvt.valor ?? 0))}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(cardCls, 'p-5')}>
            <div className="mb-4 flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-teal-600" />
              <h2 className="text-base font-semibold text-gray-900">Validaciones en cola</h2>
            </div>
            <div className="grid gap-2">
              <Button
                variant="outline"
                onClick={() => enqueue('validar_documentos_soporte')}
                disabled={jobRunning}
              >
                Crear job de documento soporte
              </Button>
              <Button
                variant="outline"
                onClick={() => enqueue('validar_exogena', { año: currentYear })}
                disabled={jobRunning}
              >
                Crear job de exógena {currentYear}
              </Button>
              <Button onClick={runQueue} disabled={jobRunning}>
                <PlayCircle className="h-4 w-4" />
                {jobRunning ? 'Procesando cola...' : 'Ejecutar cola ahora'}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {latestJobs.length === 0 ? (
                <p className="text-sm text-gray-400">No hay jobs registrados todavía.</p>
              ) : latestJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-gray-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{job.tipo}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      job.estado === 'completado'
                        ? 'bg-emerald-50 text-emerald-700'
                        : job.estado === 'fallido'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}>
                      {job.estado}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(job.created_at).toLocaleString('es-CO')} · intento {job.attempts}/{job.max_attempts}
                  </p>
                  {job.last_error && <p className="mt-1 text-xs text-red-600">{job.last_error}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
