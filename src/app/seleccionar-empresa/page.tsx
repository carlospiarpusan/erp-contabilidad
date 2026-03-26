'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Building2, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'

interface EmpresaOption {
  empresa_id: string
  nombre: string
  nit: string
  rol: string
  rol_label: string
  es_principal: boolean
  es_activa: boolean
}

export default function SeleccionarEmpresaPage() {
  const router = useRouter()
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/mis-empresas')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          if (data.length <= 1) {
            router.push('/')
            router.refresh()
            return
          }
          setEmpresas(data)
        } else {
          setError(data?.error ?? 'Error al cargar empresas')
        }
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSelect(empresaId: string) {
    setSwitching(empresaId)
    setError('')
    try {
      const res = await fetch('/api/auth/cambiar-empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa_id: empresaId }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? 'Error al cambiar empresa')
        setSwitching(null)
        return
      }
      router.push('/')
      router.refresh()
    } catch {
      setError('Error de conexión')
      setSwitching(null)
    }
  }

  return (
    <div className="clovent-grid relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(19,148,135,0.24)_0%,rgba(19,148,135,0)_72%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-6%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,125,255,0.16)_0%,rgba(79,125,255,0)_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full">
          <div className="mb-6 flex items-center justify-center gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="text-2xl font-black tracking-[-0.04em] text-gray-950 dark:text-gray-100">ClovEnt</p>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">clovent.co</p>
            </div>
          </div>

          <div className="clovent-panel rounded-[2rem] p-8 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="clovent-chip">Multi-empresa</span>
                <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-gray-950 dark:text-gray-100">
                  Seleccionar empresa
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Tienes acceso a varias empresas. Selecciona con cual deseas trabajar.
                </p>
              </div>
              <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 sm:flex">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            {loading && (
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando empresas...
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {!loading && empresas.length > 0 && (
              <div className="mt-6 flex flex-col gap-3">
                {empresas.map((emp) => (
                  <button
                    key={emp.empresa_id}
                    onClick={() => handleSelect(emp.empresa_id)}
                    disabled={switching !== null}
                    className={`group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                      emp.es_activa
                        ? 'border-teal-300 bg-teal-50/60 dark:border-teal-700 dark:bg-teal-900/20'
                        : 'border-gray-200/80 bg-white/60 hover:border-teal-200 hover:bg-teal-50/30 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:border-teal-800 dark:hover:bg-teal-900/10'
                    }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      emp.es_activa
                        ? 'bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300'
                        : 'bg-gray-100 text-gray-500 group-hover:bg-teal-500/10 group-hover:text-teal-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {switching === emp.empresa_id
                        ? <Loader2 className="h-5 w-5 animate-spin" />
                        : emp.es_activa
                          ? <CheckCircle2 className="h-5 w-5" />
                          : <Building2 className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {emp.nombre}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {emp.nit && <span>NIT: {emp.nit}</span>}
                        <span className="clovent-chip !text-[10px]">{emp.rol_label}</span>
                        {emp.es_principal && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                            Principal
                          </span>
                        )}
                      </div>
                    </div>
                    {emp.es_activa && (
                      <div className="shrink-0">
                        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                          Activa
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
                    router.push('/login')
                    router.refresh()
                  })
                }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                Cerrar sesion
              </Button>
              <span className="text-xs text-gray-400 dark:text-gray-500">clovent.co</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
