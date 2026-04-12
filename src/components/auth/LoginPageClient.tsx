'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRight, Loader2, Lock, ShieldCheck, User } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'

export function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [identifier, setIdentifier] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const registered = searchParams.get('registered') === '1'

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

    if (body?.seleccionar_empresa) {
      router.push('/seleccionar-empresa')
      router.refresh()
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="clovent-grid relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(19,148,135,0.22)_0%,rgba(19,148,135,0)_72%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-6%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,125,255,0.14)_0%,rgba(79,125,255,0)_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-lg">
              <div className="flex items-center gap-4">
                <BrandMark size="xl" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">ClovEnt</p>
                  <h1 className="mt-1 text-5xl font-black tracking-[-0.05em] text-gray-950">Inicia sesión</h1>
                </div>
              </div>
              <p className="mt-8 text-3xl font-semibold leading-tight text-gray-900">
                Entra a tu operación, sin ruido y con acceso directo a lo importante.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  'Ventas, compras, inventario y contabilidad en el mismo entorno',
                  'Acceso por roles y control por empresa',
                  'Registro inicial disponible para nuevas empresas',
                ].map((item) => (
                  <div key={item} className="clovent-panel rounded-2xl p-4">
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <BrandMark size="lg" />
              <div>
                <p className="text-2xl font-black tracking-[-0.04em] text-gray-950">ClovEnt</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Acceso seguro</p>
              </div>
            </div>

            <div className="clovent-panel rounded-[2rem] p-8 sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="clovent-chip">Acceso</span>
                  <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-gray-950">Entrar a ClovEnt</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Ingresa con tu correo o cédula para abrir tu entorno de trabajo.
                  </p>
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 sm:flex">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              {registered && (
                <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-700">
                  Registro completado. Ya puedes iniciar sesión con tu correo administrador.
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
                <div>
                  <label htmlFor="identifier" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Email o cédula
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      placeholder="correo@empresa.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      required
                      autoFocus
                      className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                    <input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <Button type="submit" className="mt-2 h-12 w-full rounded-2xl text-sm" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</>
                    : <>Entrar <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>

              <div className="mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                <p className="font-semibold text-gray-900">¿Tu empresa aún no tiene acceso?</p>
                <p className="mt-1">Ahora puedes crear el registro inicial de tu empresa desde la web.</p>
                <Link href="/registro" className="mt-3 inline-flex items-center gap-2 font-semibold text-teal-700 hover:text-teal-800">
                  Registrar empresa <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 text-xs text-gray-400">
                <span>clovent.co</span>
                <Link href="/precios" className="hover:text-teal-700">Ver planes</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
