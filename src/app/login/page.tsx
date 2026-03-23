'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRight, Globe, Loader2, Lock, Package, Receipt, ShieldCheck, User } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const highlights = [
    {
      icon: Package,
      title: 'Inventario vivo',
      text: 'Productos, bodegas y rotacion en una sola vista operativa.',
    },
    {
      icon: Receipt,
      title: 'Ventas y compras',
      text: 'Facturas, recaudos, proveedores e importacion masiva lista para migracion.',
    },
    {
      icon: ShieldCheck,
      title: 'Control contable',
      text: 'Roles, auditoria y reportes para operar sin salir del ERP.',
    },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    })
    const body = await res.json().catch(() => null)

    if (!res.ok) {
      setError(body?.error ?? 'Usuario o contraseña incorrectos')
      setLoading(false)
      return
    }

    if (body?.debe_cambiar_password) {
      router.push('/cambiar-password')
      router.refresh()
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="clovent-grid relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(19,148,135,0.24)_0%,rgba(19,148,135,0)_72%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-6%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,125,255,0.16)_0%,rgba(79,125,255,0)_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <span className="clovent-chip">
                <Globe className="h-3.5 w-3.5" />
                clovent.co
              </span>
              <div className="mt-6 flex items-center gap-4">
                <BrandMark size="xl" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">Trebol de 4 hojas</p>
                  <h1 className="mt-1 text-5xl font-black tracking-[-0.05em] text-gray-950 dark:text-white">ClovEnt</h1>
                </div>
              </div>
              <p className="mt-8 text-3xl font-semibold leading-tight text-gray-900 dark:text-gray-100">
                Ventas, compras, inventario y contabilidad en una sola operacion.
              </p>
              <p className="mt-4 max-w-lg text-base leading-7 text-gray-600 dark:text-gray-400">
                Un entorno hecho para operar rapido, migrar desde otras plataformas con hojas de calculo y mantener el control diario del negocio sin friccion.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item.title} className="clovent-panel rounded-2xl p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-500/12 text-teal-700 dark:bg-teal-400/12 dark:text-teal-300">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-bold text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span className="clovent-chip">Multiempresa</span>
                <span className="clovent-chip">Importacion CSV/XLSX</span>
                <span className="clovent-chip">Colombia</span>
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <BrandMark size="lg" />
              <div>
                <p className="text-2xl font-black tracking-[-0.04em] text-gray-950 dark:text-gray-100">ClovEnt</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">clovent.co</p>
              </div>
            </div>

            <div className="clovent-panel rounded-[2rem] p-8 sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="clovent-chip">Acceso seguro</span>
                  <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-gray-950 dark:text-gray-100">Iniciar sesion</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    Ingresa con tu correo o cedula para entrar a tu entorno ClovEnt.
                  </p>
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300 sm:flex">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Email o cedula
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                    <input
                      type="text"
                      placeholder="correo@empresa.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      autoFocus
                      className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Contrasena
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300 dark:text-gray-600" />
                    <input
                      type="password"
                      placeholder="Tu contrasena"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:placeholder:text-gray-500"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}

                <Button type="submit" className="mt-2 h-12 w-full rounded-2xl text-sm" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</>
                    : <>Entrar a ClovEnt <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
                <span>clovent.co</span>
                <span>Ipiales, Nariño</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
