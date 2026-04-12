'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Building2, CheckCircle2, Loader2, Mail, ShieldCheck, User } from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { Button } from '@/components/ui/button'

export function RegisterPageClient() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre_empresa: '',
    nit: '',
    nombre_admin: '',
    email_admin: '',
    password_admin: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(name: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.password_admin !== form.confirm_password) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre_empresa: form.nombre_empresa,
        nit: form.nit,
        nombre_admin: form.nombre_admin,
        email_admin: form.email_admin,
        password_admin: form.password_admin,
      }),
    })

    const body = await res.json().catch(() => null)

    if (!res.ok) {
      setError(body?.error ?? 'No fue posible registrar la empresa')
      setLoading(false)
      return
    }

    setSuccess('Empresa creada correctamente. Ahora puedes iniciar sesión con el correo administrador.')
    setLoading(false)
    setTimeout(() => {
      router.push(`/login?registered=1&email=${encodeURIComponent(form.email_admin)}`)
    }, 1200)
  }

  return (
    <div className="clovent-grid relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute left-[-8%] top-[-12%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(19,148,135,0.22)_0%,rgba(19,148,135,0)_72%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-[-10%] right-[-6%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,125,255,0.14)_0%,rgba(79,125,255,0)_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <section className="hidden lg:block">
            <div className="max-w-xl">
              <div className="flex items-center gap-4">
                <BrandMark size="xl" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">ClovEnt</p>
                  <h1 className="mt-1 text-5xl font-black tracking-[-0.05em] text-gray-950">Activa tu empresa</h1>
                </div>
              </div>
              <p className="mt-8 text-3xl font-semibold leading-tight text-gray-900">
                Crea el acceso inicial de tu empresa y empieza a operar en una sola plataforma.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  'Se crea la empresa y el usuario administrador inicial',
                  'Queda lista la base para ventas, compras, inventario y contabilidad',
                  'Después puedes entrar con el correo administrador que registres',
                ].map((item) => (
                  <div key={item} className="clovent-panel rounded-2xl p-4">
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto w-full max-w-xl">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <BrandMark size="lg" />
              <div>
                <p className="text-2xl font-black tracking-[-0.04em] text-gray-950">ClovEnt</p>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">Registro de empresa</p>
              </div>
            </div>

            <div className="clovent-panel rounded-[2rem] p-8 sm:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="clovent-chip">Nuevo acceso</span>
                  <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-gray-950">Registrar empresa</h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Crea la empresa y el usuario administrador inicial para entrar a ClovEnt.
                  </p>
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-700 sm:flex">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="nombre_empresa" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Empresa
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                    <input id="nombre_empresa" name="nombre_empresa" value={form.nombre_empresa} onChange={(e) => updateField('nombre_empresa', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="Nombre de la empresa" />
                  </div>
                </div>

                <div>
                  <label htmlFor="nit" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">NIT</label>
                  <input id="nit" name="nit" value={form.nit} onChange={(e) => updateField('nit', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="900123456" />
                </div>

                <div>
                  <label htmlFor="nombre_admin" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Administrador</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                    <input id="nombre_admin" name="nombre_admin" value={form.nombre_admin} onChange={(e) => updateField('nombre_admin', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="Nombre completo" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="email_admin" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Correo administrador</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                    <input id="email_admin" name="email_admin" type="email" autoComplete="email" value={form.email_admin} onChange={(e) => updateField('email_admin', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="admin@empresa.com" />
                  </div>
                </div>

                <div>
                  <label htmlFor="password_admin" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Contraseña</label>
                  <input id="password_admin" name="password_admin" type="password" autoComplete="new-password" value={form.password_admin} onChange={(e) => updateField('password_admin', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="Mínimo 6 caracteres" />
                </div>

                <div>
                  <label htmlFor="confirm_password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Confirmar contraseña</label>
                  <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" value={form.confirm_password} onChange={(e) => updateField('confirm_password', e.target.value)} required className="flex h-12 w-full rounded-2xl border border-gray-200/80 bg-white/85 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/12" placeholder="Repite la contraseña" />
                </div>

                {error && <div className="sm:col-span-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
                {success && <div className="sm:col-span-2 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-700">{success}</div>}

                <div className="sm:col-span-2">
                  <Button type="submit" className="mt-2 h-12 w-full rounded-2xl text-sm" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando empresa...</> : <>Crear empresa <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </div>
              </form>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-5 text-sm text-gray-500">
                <span>¿Ya tienes acceso?</span>
                <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">Iniciar sesión</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
